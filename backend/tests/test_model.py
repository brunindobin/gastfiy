"""Testes do modelo ORM `Gasto` e da configuração de conexão.

Não abrem conexão com o PostgreSQL: inspecionam o `metadata` do SQLAlchemy
(contrato da tabela) e a URL montada a partir do `.env`. Isso garante que
mudanças no modelo não passem sem revisão — e que nenhuma credencial volte a ser
hardcoded no futuro.
"""

from __future__ import annotations

from app.core.config import Settings
from app.database.base import Base
from app.models import CategoriaGasto, Gasto


# ---------------------------------------------------------------------------
# Contrato da tabela
# ---------------------------------------------------------------------------
def test_tabela_gastos_tem_as_colunas_do_produto() -> None:
    """Nome, Valor, Data e Categoria (+ id e auditoria) são obrigatórios."""
    tabela = Base.metadata.tables["gastos"]

    assert set(tabela.columns.keys()) == {
        "id",
        "nome",
        "usuario_id",
        "valor",
        "data",
        "categoria",
        "criado_em",
        "atualizado_em",
    }


def test_coluna_data_e_indexada() -> None:
    """A home filtra por dia e o dashboard agrega por mês/ano: índice é essencial."""
    tabela = Base.metadata.tables["gastos"]

    assert tabela.columns["data"].index is True


def test_valor_usa_numeric_e_nao_float() -> None:
    """Dinheiro precisa de precisão exata; Float acumularia erro de arredondamento."""
    tipo = Base.metadata.tables["gastos"].columns["valor"].type

    assert tipo.__class__.__name__ == "Numeric"
    assert tipo.precision == 12
    assert tipo.scale == 2


def test_campos_obrigatorios_sao_not_null() -> None:
    """nome, valor e data nunca podem ser nulos no banco."""
    tabela = Base.metadata.tables["gastos"]

    for campo in ("nome", "valor", "data", "categoria", "usuario_id"):
        assert tabela.columns[campo].nullable is False, campo


def test_existem_checks_de_integridade_no_banco() -> None:
    """Defesa em profundidade: banco recusa valor <= 0 e nome vazio.

    Os nomes seguem a convenção definida em `database/base.py`
    (`ck_%(table_name)s_%(constraint_name)s`).
    """
    nomes = {c.name for c in Base.metadata.tables["gastos"].constraints}

    assert "ck_gastos_valor_positivo" in nomes
    assert "ck_gastos_nome_nao_vazio" in nomes


# ---------------------------------------------------------------------------
# Categorias
# ---------------------------------------------------------------------------
def test_categorias_do_produto_estao_disponiveis() -> None:
    """As categorias do app (Gastos Obrigatórios, Lazer, ...) existem com slug."""
    assert CategoriaGasto.GASTOS_OBRIGATORIOS.value == "gastos_obrigatorios"
    assert CategoriaGasto.LAZER.value == "lazer"
    assert len(list(CategoriaGasto)) == 7


def test_categoria_guarda_o_slug_no_banco() -> None:
    """`values_callable` garante "lazer" no banco, e não "LAZER"."""
    tipo_enum = Gasto.__table__.c.categoria.type

    assert "lazer" in tipo_enum.enums
    assert "LAZER" not in tipo_enum.enums


# ---------------------------------------------------------------------------
# Configuração / segurança
# ---------------------------------------------------------------------------
def test_url_do_banco_e_montada_a_partir_do_env() -> None:
    """Nenhuma URL hardcoded: as partes vêm da configuração."""
    config = Settings(
        _env_file=None,  # ignora o .env local para o teste ser determinístico
        POSTGRES_USER="usuario",
        POSTGRES_PASSWORD="senha",
        POSTGRES_HOST="db.exemplo.com",
        POSTGRES_PORT=6543,
        POSTGRES_DB="gastify",
    )

    assert config.database_url == "postgresql+psycopg://usuario:senha@db.exemplo.com:6543/gastify"


def test_senha_com_caracteres_especiais_nao_quebra_a_url() -> None:
    """@, / e : na senha precisam ser codificados (quote_plus)."""
    config = Settings(
        _env_file=None,
        POSTGRES_USER="usuario",
        POSTGRES_PASSWORD="p@ss/word:x",
        POSTGRES_HOST="localhost",
        POSTGRES_PORT=5432,
        POSTGRES_DB="gastify",
    )

    assert config.database_url == (
        "postgresql+psycopg://usuario:p%40ss%2Fword%3Ax@localhost:5432/gastify"
    )


def test_cors_aceita_lista_separada_por_virgula() -> None:
    """Em produção o CORS é restrito a origens explícitas."""
    config = Settings(_env_file=None, CORS_ORIGINS="http://a.com, http://b.com")

    assert config.cors_origins_lista == ["http://a.com", "http://b.com"]


# ---------------------------------------------------------------------------
# DDL (validação sem banco)
# ---------------------------------------------------------------------------
def test_modelo_gera_ddl_valido_para_postgresql() -> None:
    """Compila o CREATE TABLE no dialeto do PostgreSQL.

    Por que: garante que o modelo é traduzível para SQL real (tipo UUID, ENUM,
    NUMERIC, checks) mesmo em ambiente sem PostgreSQL instalado — o caso do CI e
    de quem só quer rodar os testes.
    """
    from sqlalchemy.dialects import postgresql
    from sqlalchemy.schema import CreateTable

    ddl = str(
        CreateTable(Base.metadata.tables["gastos"]).compile(dialect=postgresql.dialect())
    )

    assert "CREATE TABLE gastos" in ddl
    assert "categoria_gasto" in ddl          # ENUM criado com nome estável
    assert "NUMERIC(12, 2)" in ddl
    assert "ck_gastos_valor_positivo" in ddl
