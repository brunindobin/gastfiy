"""Sessão do PostgreSQL (banco principal) — engine e dependência `get_db()`.

Decisões de performance/confiabilidade:
  * `pool_pre_ping=True`: antes de entregar uma conexão do pool, o SQLAlchemy faz
    um ping. Evita o clássico erro "server closed the connection unexpectedly"
    quando o PostgreSQL reinicia ou o pool fica ocioso por muito tempo.
  * Conexão PREGUIÇOSA (lazy): o engine é criado sob demanda e o SQLAlchemy não
    abre conexão no import. Assim a API sobe mesmo com o banco fora do ar e o
    problema aparece apenas em `GET /health` (503) — a aplicação não "morre".
  * `pool_recycle=1800`: recicla conexões com mais de 30 min, evitando timeouts
    impostos por firewalls/proxies.
"""

from __future__ import annotations

from collections.abc import Generator
from functools import lru_cache

from sqlalchemy import create_engine
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session, sessionmaker

from app.core.config import get_settings


@lru_cache(maxsize=1)
def get_engine() -> Engine:
    """Cria (uma única vez) e devolve o engine do PostgreSQL.

    O engine é um objeto "leve": não abre conexão aqui, apenas guarda a URL e a
    configuração do pool. A primeira conexão real acontece no primeiro `connect()`
    (por isso é lazy). O cache evita recriar o pool a cada request.
    """
    config = get_settings()
    return create_engine(
        config.database_url,
        # --- Confiabilidade ---
        pool_pre_ping=True,
        pool_recycle=1800,
        # --- Performance ---
        pool_size=config.DB_POOL_SIZE,
        max_overflow=config.DB_MAX_OVERFLOW,
        pool_timeout=config.DB_POOL_TIMEOUT,
        # `future=True` fixa o estilo 2.x (explícito, mesmo já sendo o padrão).
        future=True,
        echo=config.DB_ECHO,
        # Timeout curto na abertura de conexão: se o banco estiver inacessível, o
        # /health responde 503 em segundos em vez de pendurar o cliente.
        connect_args={
            "connect_timeout": config.DB_CONNECT_TIMEOUT,
            "application_name": "gastify-api",
        },
    )


@lru_cache(maxsize=1)
def get_session_factory() -> sessionmaker[Session]:
    """Fábrica de sessões ligada ao engine (também criada sob demanda).

    `expire_on_commit=False` mantém os atributos do objeto acessíveis após o
    commit — evita um SELECT extra só para montar a resposta do POST/PUT
    (ganho direto de latência nos endpoints de escrita).
    """
    return sessionmaker(
        bind=get_engine(),
        autoflush=False,
        autocommit=False,
        expire_on_commit=False,
        class_=Session,
    )


def get_db() -> Generator[Session, None, None]:
    """Dependência do FastAPI que entrega uma sessão por request.

    Garantias:
      * uma sessão isolada por requisição (sem estado compartilhado entre
        usuários — importante para segurança);
      * `close()` no `finally` devolve a conexão ao pool mesmo em caso de erro;
      * o commit é responsabilidade da camada de serviço (transação explícita).
    """
    sessao = get_session_factory()()
    try:
        yield sessao
    finally:
        sessao.close()


def descartar_engine() -> None:
    """Libera o pool e limpa o cache do engine (usado no shutdown e em testes).

    Chamar no encerramento da aplicação evita conexões "fantasma" no PostgreSQL
    durante o reload do uvicorn.
    """
    if get_engine.cache_info().currsize:
        get_engine().dispose()
    get_engine.cache_clear()
    get_session_factory.cache_clear()
