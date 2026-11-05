"""Configuração compartilhada da suíte de testes.

Dois grupos de testes convivem aqui:
  * **unitários** (schemas, handlers, health com monkeypatch) — não tocam em
    banco e rodam em qualquer máquina;
  * **integração** (auth, CRUD, agregações, Double Backup) — usam PostgreSQL e
    MongoDB reais. Se o banco não estiver disponível, são PULADOS com mensagem
    clara (o CI sem infraestrutura continua verde).

Isolamento: os testes usam bancos separados (`gastify_teste` em ambos), então
nunca apagam os dados de desenvolvimento. As tabelas são truncadas antes de
cada teste.
"""

from __future__ import annotations

import os
import uuid

# ---------------------------------------------------------------------------
# Variáveis de ambiente — precisam ser definidas ANTES de importar o app,
# porque `get_settings()` é cacheado no primeiro import.
# ---------------------------------------------------------------------------
os.environ["ENVIRONMENT"] = "test"
os.environ["DEBUG"] = "false"
os.environ["AUTO_CREATE_TABLES"] = "false"  # tabelas são criadas pelo fixture
os.environ["SECRET_KEY"] = "chave-de-teste-nao-use-em-producao-0123456789abcdef"
os.environ["POSTGRES_DB"] = "gastify_teste"  # nunca toca no banco de dev
os.environ["MONGO_DB"] = "gastify_teste"
os.environ["MONGO_TIMEOUT_MS"] = "400"       # falha rápido quando o Mongo está fora

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text

from app.core.security import gerar_hash_senha
from app.database import nosql
from app.database.base import Base
from app.database.session import get_engine, get_session_factory
from app.main import app

SENHA_PADRAO = "senha12345"


def _postgres_disponivel() -> bool:
    """Testa a conexão com o PostgreSQL sem deixar a suíte falhar por infra."""
    try:
        with get_engine().connect() as conexao:
            conexao.execute(text("SELECT 1"))
        return True
    except Exception:  # noqa: BLE001 - qualquer falha significa "sem banco"
        return False


@pytest.fixture(scope="session")
def banco_pronto() -> None:
    """Garante as tabelas no banco de teste ou pula os testes de integração."""
    if not _postgres_disponivel():
        pytest.skip("PostgreSQL indisponível: testes de integração pulados.")

    # Importa os modelos para registrar as tabelas no metadata.
    import app.models  # noqa: F401

    Base.metadata.create_all(bind=get_engine())
    yield


@pytest.fixture()
def db(banco_pronto):
    """Sessão de teste com tabelas limpas antes de cada caso."""
    sessao = get_session_factory()()
    try:
        # CASCADE remove gastos junto com usuários; RESTART IDENTITY não é
        # necessário (UUID), mas mantém a semântica de "banco limpo".
        sessao.execute(text("TRUNCATE TABLE gastos, usuarios CASCADE"))
        sessao.commit()
        yield sessao
    finally:
        sessao.close()


@pytest.fixture()
def cliente(banco_pronto, db) -> TestClient:
    """Cliente HTTP em memória (não abre porta de rede).

    Depende de `db` de propósito: assim TODA suíte de API começa com as tabelas
    limpas, sem um teste enxergar dados do anterior.

    `raise_server_exceptions=False` faz o teste receber a resposta de erro do
    handler global — é assim que validamos a regra de "no leak".
    """
    return TestClient(app, raise_server_exceptions=False)


@pytest.fixture(autouse=True)
def bcrypt_rapido(monkeypatch):
    """Reduz o custo do bcrypt nos testes (12 -> 4).

    O hash continua sendo real (bcrypt de verdade), mas 4 rounds deixam a suíte
    rápida. O custo de produção segue 12 em `app/core/security.py`.
    """
    monkeypatch.setattr("app.core.security.CUSTO_BCRYPT", 4)


@pytest.fixture()
def usuario(cliente: TestClient) -> dict:
    """Cria um usuário via API e devolve o JSON público."""
    email = f"teste-{uuid.uuid4().hex[:10]}@gastify.dev"
    resposta = cliente.post(
        "/api/v1/auth/registrar",
        json={"nome": "Usuário Teste", "email": email, "senha": SENHA_PADRAO},
    )
    assert resposta.status_code == 201, resposta.text
    dados = resposta.json()
    dados["senha"] = SENHA_PADRAO
    return dados


@pytest.fixture()
def token(cliente: TestClient, usuario: dict) -> str:
    """Faz login e devolve o access token."""
    resposta = cliente.post(
        "/api/v1/auth/login",
        json={"email": usuario["email"], "senha": usuario["senha"]},
    )
    assert resposta.status_code == 200, resposta.text
    return resposta.json()["access_token"]


@pytest.fixture()
def cabecalhos(token: str) -> dict[str, str]:
    """Header pronto para as rotas protegidas."""
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture()
def outro_usuario(cliente: TestClient) -> tuple[dict, dict[str, str]]:
    """Segundo usuário (para testar isolamento de dados)."""
    email = f"outro-{uuid.uuid4().hex[:10]}@gastify.dev"
    registro = cliente.post(
        "/api/v1/auth/registrar",
        json={"nome": "Outro Usuário", "email": email, "senha": SENHA_PADRAO},
    )
    assert registro.status_code == 201, registro.text
    login = cliente.post(
        "/api/v1/auth/login",
        json={"email": email, "senha": SENHA_PADRAO},
    )
    return registro.json(), {"Authorization": f"Bearer {login.json()['access_token']}"}


@pytest.fixture()
def colecao_mongo():
    """Coleção do MongoDB de teste limpa, ou pula se o NoSQL estiver fora."""
    if not nosql.verificar_conexao():
        pytest.skip("MongoDB indisponível: testes de Double Backup pulados.")

    colecao = nosql.get_colecao_gastos()
    colecao.delete_many({})
    yield colecao
    colecao.delete_many({})


def hash_de_teste(senha: str = SENHA_PADRAO) -> str:
    """Atalho para criar usuários direto no banco em testes específicos."""
    return gerar_hash_senha(senha)
