"""Ponto de entrada da API GASTIFY (FastAPI).

Responsabilidades deste arquivo (e só estas):
  1. Montar a aplicação (`create_app`) com metadados e documentação;
  2. Registrar middleware de CORS, routers e handlers globais de erro;
  3. Gerenciar o ciclo de vida (startup/shutdown) sem derrubar a API quando o
     banco estiver indisponível.

Nenhuma regra de negócio mora aqui: rotas ficam em `app/routers`, validação em
`app/schemas`, persistência em `app/services`/`app/database`. Essa separação é a
Arquitetura Limpa exigida no AGENTS.md — cada camada pode ser testada isolada.

Como rodar (a partir da pasta `backend/`):
    uvicorn app.main:app --reload --port 8000
"""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager
from collections.abc import AsyncIterator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import get_settings
from app.core.exceptions import registrar_handlers
from app.database import nosql
from app.database.session import descartar_engine
from app.routers import agregacoes, auth, gastos, health

# Logger da aplicação. Usamos logging (e não print) para que o time consiga
# filtrar nível e direcionar saída para arquivo/observabilidade depois.
logger = logging.getLogger("gastify")


@asynccontextmanager
async def ciclo_de_vida(_: FastAPI) -> AsyncIterator[None]:
    """Startup e shutdown da aplicação.

    STARTUP:
      * Apenas registra em log que a API subiu (útil para saber se o processo
        reiniciou por crash ou por deploy).
      * Se `AUTO_CREATE_TABLES=true` no .env, cria as tabelas que faltarem.
        Isso é um atalho de DESENVOLVIMENTO: em produção o correto é migração
        versionada (Alembic). A criação é protegida por try/except de propósito:
        banco fora do ar NÃO pode impedir a API de subir — o problema aparece no
        `/health` (503) e o time corrige sem a aplicação "morrer".

    SHUTDOWN:
      * Fecha o pool de conexões para não deixar conexões fantasmas no
        PostgreSQL durante o reload do uvicorn.
    """
    config = get_settings()
    logger.info(
        "GASTIFY API iniciada | ambiente=%s | versao=%s | docs=%s",
        config.ENVIRONMENT,
        config.APP_VERSION,
        "/docs" if config.DEBUG else "desativado",
    )

    if config.AUTO_CREATE_TABLES:
        try:
            # Import local: evita carregar os modelos (e o driver) quando o
            # recurso está desligado.
            from app.database.base import criar_tabelas

            criar_tabelas()
            logger.info("Tabelas verificadas/criadas automaticamente (AUTO_CREATE_TABLES=true).")
        except Exception as erro:  # noqa: BLE001 - startup nunca deve abortar por banco
            logger.warning(
                "Não foi possível criar as tabelas automaticamente (%s). "
                "A API continua no ar; verifique /health e o .env.",
                erro.__class__.__name__,
            )

    yield  # aqui a aplicação fica atendendo requisições

    descartar_engine()
    nosql.fechar_cliente()
    logger.info("GASTIFY API encerrada e pools de conexão liberados.")


def create_app() -> FastAPI:
    """Cria e configura a instância do FastAPI.

    Fica em uma função (factory) para permitir testes que precisem de uma
    aplicação "nova" (ex.: sobrescrever dependências) sem herdar estado global.
    """
    config = get_settings()

    app = FastAPI(
        title=config.APP_NAME,
        version=config.APP_VERSION,
        description=config.APP_DESCRIPTION,
        # Documentação interativa apenas quando DEBUG=true: em produção ela
        # exporia o mapa completo da API para qualquer visitante.
        docs_url="/docs" if config.DEBUG else None,
        redoc_url="/redoc" if config.DEBUG else None,
        openapi_url="/openapi.json" if config.DEBUG else None,
        lifespan=ciclo_de_vida,
    )

    # ----------------------------- CORS -----------------------------------
    # Liberado em desenvolvimento (CORS_ORIGINS="*") para o emulador Android e o
    # Swagger funcionarem sem atrito. Em produção, restringir no .env para os
    # domínios reais — "*" + credenciais é rejeitado pelos navegadores, por isso
    # só habilitamos credenciais quando as origens são explícitas.
    origens = config.cors_origins_lista
    app.add_middleware(
        CORSMiddleware,
        allow_origins=origens,
        allow_credentials=origens != ["*"],
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # ------------------------ Tratamento de erros -------------------------
    # Registrado ANTES dos routers: qualquer endpoint novo já nasce protegido
    # pelo JSON amigável (sem stack trace / sem dados do banco).
    registrar_handlers(app)

    # ------------------------------ Routers -------------------------------
    app.include_router(health.router)  # GET /health, GET /health/live
    # Prefixo versionado concentrado aqui: os routers não conhecem a versão da API.
    app.include_router(auth.router, prefix=config.API_V1_PREFIX)
    app.include_router(gastos.router, prefix=f"{config.API_V1_PREFIX}/gastos")
    app.include_router(agregacoes.router, prefix=config.API_V1_PREFIX)

    # ---------------------------- Rota raiz -------------------------------
    @app.get("/", tags=["raiz"], summary="Metadados da API")
    def raiz() -> dict[str, str | bool]:
        """Responde metadados básicos — útil para saber se o deploy subiu.

        Mantém a resposta curta e sem informação sensível (nada de versão de
        banco, host, variáveis de ambiente).
        """
        return {
            "nome": config.APP_NAME,
            "versao": config.APP_VERSION,
            "status": "online",
            "ambiente": config.ENVIRONMENT,
            "documentacao": "/docs" if config.DEBUG else "desativada",
            "mensagem": "API do GASTIFY no ar. Desenvolvido por Bruno Merullo.",
        }

    return app


# Configuração mínima de log: nível INFO em desenvolvimento (para ver as
# mensagens de startup) e WARNING em produção (menos ruído, menos vazamento).
logging.basicConfig(
    level=logging.INFO if get_settings().DEBUG else logging.WARNING,
    format="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
)

# Instância usada pelo uvicorn: `app.main:app`.
app = create_app()
