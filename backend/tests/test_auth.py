"""Testes de integração da autenticação (JWT).

Cobrem o caminho completo: cadastro -> login -> uso do token. Também verificam
as regras de segurança do projeto: senha nunca volta na resposta, mensagem de
erro genérica e rotas protegidas recusando requisição sem token.
"""

from __future__ import annotations

from tests.conftest import SENHA_PADRAO


def _registrar(cliente, email: str, nome: str = "Bruno Merullo", senha: str = SENHA_PADRAO):
    return cliente.post(
        "/api/v1/auth/registrar",
        json={"nome": nome, "email": email, "senha": senha},
    )


def test_cadastro_devolve_dados_publicos_sem_senha(cliente) -> None:
    """201 com id/nome/e-mail; nada de senha ou hash no corpo."""
    resposta = _registrar(cliente, "bruno@gastify.dev")

    assert resposta.status_code == 201
    corpo = resposta.json()
    assert corpo["email"] == "bruno@gastify.dev"
    assert corpo["nome"] == "Bruno Merullo"
    assert corpo["id"]

    texto = resposta.text.lower()
    assert "senha" not in texto
    assert "hash" not in texto


def test_email_e_normalizado_para_minusculas(cliente) -> None:
    """Cadastro com maiúsculas deve ser recuperável no login em minúsculas."""
    _registrar(cliente, "Bruno.Merullo@Gastify.DEV")

    login = cliente.post(
        "/api/v1/auth/login",
        json={"email": "bruno.merullo@gastify.dev", "senha": SENHA_PADRAO},
    )
    assert login.status_code == 200


def test_email_duplicado_retorna_409(cliente) -> None:
    """Um cadastro por e-mail (o índice único do banco é a última defesa)."""
    _registrar(cliente, "repetido@gastify.dev")

    resposta = _registrar(cliente, "repetido@gastify.dev")

    assert resposta.status_code == 409
    assert resposta.json()["codigo"] == "EMAIL_JA_CADASTRADO"


def test_login_devolve_token_e_usuario(cliente) -> None:
    """Login válido entrega token, validade e dados do usuário."""
    _registrar(cliente, "login@gastify.dev")

    resposta = cliente.post(
        "/api/v1/auth/login",
        json={"email": "login@gastify.dev", "senha": SENHA_PADRAO},
    )

    assert resposta.status_code == 200
    corpo = resposta.json()
    assert corpo["token_type"] == "bearer"
    assert corpo["access_token"]
    assert corpo["expira_em_minutos"] > 0
    assert corpo["usuario"]["email"] == "login@gastify.dev"


def test_senha_errada_e_email_inexistente_dao_a_mesma_resposta(cliente) -> None:
    """Mensagem idêntica evita descobrir quais e-mails existem."""
    _registrar(cliente, "existe@gastify.dev")

    senha_errada = cliente.post(
        "/api/v1/auth/login",
        json={"email": "existe@gastify.dev", "senha": "senha-errada-123"},
    )
    email_inexistente = cliente.post(
        "/api/v1/auth/login",
        json={"email": "nao-existe@gastify.dev", "senha": SENHA_PADRAO},
    )

    assert senha_errada.status_code == email_inexistente.status_code == 401
    assert senha_errada.json() == email_inexistente.json()
    assert senha_errada.json()["codigo"] == "CREDENCIAIS_INVALIDAS"


def test_eu_exige_token(cliente) -> None:
    """Sem header Authorization a resposta é 401 no formato do projeto."""
    resposta = cliente.get("/api/v1/auth/eu")

    assert resposta.status_code == 401
    assert resposta.json()["codigo"] == "NAO_AUTORIZADO"


def test_eu_com_token_valido(cliente, usuario, cabecalhos) -> None:
    """Com token válido devolve o usuário autenticado."""
    resposta = cliente.get("/api/v1/auth/eu", headers=cabecalhos)

    assert resposta.status_code == 200
    assert resposta.json()["id"] == usuario["id"]


def test_token_invalido_retorna_401(cliente) -> None:
    """Token adulterado não vira 500 nem vaza detalhe da biblioteca."""
    resposta = cliente.get(
        "/api/v1/auth/eu",
        headers={"Authorization": "Bearer token.completamente.invalido"},
    )

    assert resposta.status_code == 401
    assert resposta.json()["codigo"] == "TOKEN_INVALIDO"
    assert "traceback" not in resposta.text.lower()


def test_senha_curta_e_email_invalido_retornam_422(cliente) -> None:
    """Validação do Pydantic com mensagens em PT-BR."""
    senha_curta = _registrar(cliente, "curta@gastify.dev", senha="123")
    email_invalido = _registrar(cliente, "isso-nao-e-email")

    assert senha_curta.status_code == 422
    assert email_invalido.status_code == 422
    assert senha_curta.json()["codigo"] == "VALIDACAO"
