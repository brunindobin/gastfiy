"""Base declarativa do SQLAlchemy 2.x para o banco principal (PostgreSQL).

Todos os modelos herdam de `Base`. A convenção de nomes de constraints é
definida aqui (e não em cada modelo) porque:
    1. O PostgreSQL gera nomes automáticos pouco legíveis (ex.: gasto_categoria_check).
    2. Nomes previsíveis tornam migrações (Alembic) e mensagens de erro internas
       consistentes, sem precisar caçar constraint no banco.
"""

from sqlalchemy import MetaData
from sqlalchemy.orm import DeclarativeBase

# Convenção aplicada a índices, constraints e chaves estrangeiras criadas pelo
# SQLAlchemy. Segue o padrão recomendado pela documentação oficial (2.x).
CONVENCAO_NOMES: dict[str, str] = {
    "ix": "ix_%(column_0_label)s",
    "uq": "uq_%(table_name)s_%(column_0_name)s",
    "ck": "ck_%(table_name)s_%(constraint_name)s",
    "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
    "pk": "pk_%(table_name)s",
}


class Base(DeclarativeBase):
    """Classe base de todos os modelos ORM do GASTIFY.

    `DeclarativeBase` é o estilo moderno do SQLAlchemy 2.x (substitui
    `declarative_base()`), com suporte a tipagem via `Mapped[...]`.
    """

    metadata = MetaData(naming_convention=CONVENCAO_NOMES)


def criar_tabelas() -> None:
    """Cria as tabelas no banco principal (atalho de desenvolvimento).

    Por que existe: a Fase 1 não usa Alembic, então o time precisa de um caminho
    rápido para preparar o banco local. Em produção o correto é usar migrações
    versionadas (Alembic, previsto como opcional no requirements).

    Importante: importamos os modelos antes de criar, senão o `metadata` fica
    vazio e nenhuma tabela é gerada.
    """
    from app import models  # noqa: F401  (import com efeito colateral: registra os modelos)
    from app.database.session import get_engine

    Base.metadata.create_all(bind=get_engine())
