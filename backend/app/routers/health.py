"""Endpoints de saúde da API (`/health` e `/health/live`).

Por que existem:
  * `/health/live` é um "estou vivo?" barato: responde sempre 200 sem tocar no
    banco. É o que orquestradores (Docker/K8s) usam para decidir se reiniciam o
    processo — um reinício não resolveria banco fora do ar.
  * `/health` é o "estou pronto para trabalhar?": tenta abrir conexão e rodar
    `SELECT 1` no PostgreSQL. Se falhar, responde 503 (serviço degradado) sem
    expor credenciais, host ou stack trace.

Regra de ouro deste módulo: o health check NUNCA lança exceção. Se ele quebrar,
o monitoramento perde o sinal justamente quando mais precisa dele.
"""

from __future__ import annotations

import logging

from fastapi import APIRouter
from fastapi.responses import JSONResponse
from sqlalchemy import text

from app.core.config import get_settings
from app.database.session import get_engine

logger = logging.getLogger("gastify.health")

# Router sem prefixo: os caminhos são definidos nos decorators abaixo.
router = APIRouter(tags=["saúde"])


def verificar_conexao_banco() -> bool:
    """Tenta uma consulta trivial no PostgreSQL e devolve True/False.

    `SELECT 1` é a checagem mais barata possível: valida de verdade que a
    conexão abre e o servidor responde (não apenas que a URL está configurada).

    O `except Exception` amplo é intencional: além de erros do SQLAlchemy
    (senha errada, banco inexistente, timeout), `get_engine()` pode falhar com
    URL inválida. Nenhum desses casos pode virar 500 no health check.
    """
    try:
        # `with` garante que a conexão volta para o pool mesmo em erro.
        with get_engine().connect() as conexao:
            conexao.execute(text("SELECT 1"))
        return True
    except Exception as erro:  # noqa: BLE001 - health check nunca deve lançar
        # Logamos só o TIPO do erro: mensagens de driver podem conter host/usuário
        # e o log é a única saída que pode ter detalhe técnico — mesmo assim,
        # mantemos o mínimo necessário para diagnóstico.
        logger.warning("Falha na checagem do banco: %s", erro.__class__.__name__)
        return False


@router.get(
    "/health/live",
    summary="Liveness probe (não toca no banco)",
    responses={200: {"description": "Processo vivo."}},
)
def liveness() -> dict[str, str]:
    """Confirma apenas que o processo está de pé e respondendo HTTP."""
    return {"status": "ok"}


@router.get(
    "/health",
    summary="Readiness probe (API + PostgreSQL)",
    responses={
        200: {"description": "API e banco principal operacionais."},
        503: {"description": "API no ar, mas o banco principal está indisponível."},
    },
)
def health() -> JSONResponse:
    """Reporta o estado da API e do banco principal.

    Usa `JSONResponse` (em vez de retornar dict) porque precisamos variar o
    status HTTP: 200 quando o banco responde e 503 quando está fora. O corpo é
    curto e sem detalhe técnico — apenas o suficiente para o app e o monitor
    entenderem o estado.
    """
    config = get_settings()
    banco_ok = verificar_conexao_banco()

    corpo = {
        "status": "ok" if banco_ok else "degraded",
        "database": "connected" if banco_ok else "unavailable",
        "versao": config.APP_VERSION,
        "ambiente": config.ENVIRONMENT,
    }
    return JSONResponse(status_code=200 if banco_ok else 503, content=corpo)
