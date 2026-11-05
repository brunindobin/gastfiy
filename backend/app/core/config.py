"""Configuração central da API GASTIFY (lida exclusivamente de variáveis de ambiente).

Regra de segurança do projeto: NENHUMA credencial (usuário, senha, host, porta,
nome do banco, segredo JWT) pode estar escrita no código. Tudo vem do arquivo
`backend/.env` (não versionado) ou de variáveis de ambiente do sistema.

Abordagem escolhida para a URL do banco (documentada também no README):
    A `DATABASE_URL` é MONTADA A PARTIR DAS PARTES
    (POSTGRES_USER, POSTGRES_PASSWORD, POSTGRES_HOST, POSTGRES_PORT, POSTGRES_DB).
    Motivo: um único formato de configuração para todo o time, validação
    individual de cada parte (ex.: porta precisa ser inteira) e possibilidade de
    reaproveitar as mesmas variáveis em docker-compose/serviços de deploy.
    A senha é codificada com `quote_plus` para suportar caracteres especiais
    (@, /, :, #) sem quebrar a URL de conexão.
"""

from functools import lru_cache
from pathlib import Path
from urllib.parse import quote_plus

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

# ---------------------------------------------------------------------------
# Caminhos base
# ---------------------------------------------------------------------------
# `__file__` é .../backend/app/core/config.py; `parents[2]` aponta para
# .../backend. Usamos caminho absoluto para que o .env seja encontrado mesmo
# quando o uvicorn/pytest é executado de outro diretório.
DIRETORIO_BACKEND: Path = Path(__file__).resolve().parents[2]
ARQUIVO_ENV: Path = DIRETORIO_BACKEND / ".env"

# Driver do PostgreSQL: psycopg 3 (binário pré-compilado).
# O SQLAlchemy 2.x exige o sufixo `+psycopg` para usar este driver.
DRIVER_POSTGRES: str = "postgresql+psycopg"


class Settings(BaseSettings):
    """Objeto imutável de configuração da aplicação.

    Cada atributo corresponde a uma chave do `.env` (mesmo nome, case-insensitive).
    Campos com valor padrão permitem que a aplicação suba em desenvolvimento sem
    .env completo; campos sensíveis (senha, JWT) NÃO possuem segredo embutido.
    """

    model_config = SettingsConfigDict(
        env_file=ARQUIVO_ENV,       # lê backend/.env automaticamente
        env_file_encoding="utf-8",
        case_sensitive=False,        # POSTGRES_USER == postgres_user
        extra="ignore",              # ignora chaves desconhecidas no .env
    )

    # --------------------------- Metadados da API ---------------------------
    APP_NAME: str = "GASTIFY API"
    APP_VERSION: str = "0.1.0"
    APP_DESCRIPTION: str = (
        "API de gestão financeira pessoal do GASTIFY: CRUD de gastos, "
        "agregações mensais/anuais e Double Backup (PostgreSQL + NoSQL)."
    )
    ENVIRONMENT: str = Field(default="development", description="development | staging | production")
    DEBUG: bool = Field(default=True, description="Liga logs detalhados e /docs; desligar em produção.")
    API_V1_PREFIX: str = Field(default="/api/v1", description="Prefixo versionado das rotas de domínio.")

    # Atalho de desenvolvimento: cria as tabelas que faltarem no startup
    # (`Base.metadata.create_all`). Fica DESLIGADO por padrão porque em produção
    # o correto é migração versionada (Alembic). Mesmo ligado, uma falha de banco
    # é apenas logada — a API sobe e o problema aparece em /health.
    AUTO_CREATE_TABLES: bool = Field(
        default=False,
        description="Cria tabelas no startup (apenas desenvolvimento).",
    )

    # ----------------------- Banco principal (PostgreSQL) -------------------
    POSTGRES_USER: str = "postgres"
    POSTGRES_PASSWORD: str = ""          # nunca há senha padrão hardcoded: fica vazio e vem do .env
    POSTGRES_HOST: str = "localhost"
    POSTGRES_PORT: int = 5432
    POSTGRES_DB: str = "gastify"

    # Pool de conexões: números modestos para caber em ambientes pequenos e
    # manter a latência baixa (conexões reaproveitadas em vez de recriadas).
    DB_POOL_SIZE: int = Field(default=5, ge=1)
    DB_MAX_OVERFLOW: int = Field(default=10, ge=0)
    DB_POOL_TIMEOUT: int = Field(default=10, ge=1)
    DB_CONNECT_TIMEOUT: int = Field(default=5, ge=1, description="Segundos para desistir de abrir conexão.")
    DB_ECHO: bool = Field(default=False, description="Espelha SQL no console (apenas debug).")

    # ------------------------------ CORS -----------------------------------
    # Mantido como string (e não list) de propósito: o pydantic-settings tenta
    # interpretar campos complexos como JSON, o que quebraria com
    # "http://a.com,http://b.com". A conversão é feita na propriedade abaixo.
    CORS_ORIGINS: str = Field(
        default="*",
        description="Origens permitidas separadas por vírgula. '*' apenas em desenvolvimento.",
    )

    # ------------------------------- JWT ------------------------------------
    # Sem valor padrão de propósito: segredo embutido no código é exatamente o
    # que a regra de segurança do projeto proíbe. Se estiver vazio, a assinatura
    # de token falha com erro claro (500 genérico no cliente, log no servidor).
    SECRET_KEY: str = Field(default="", description="Chave de assinatura do JWT (>= 32 chars).")
    JWT_ALGORITHM: str = Field(default="HS256", description="Algoritmo de assinatura do JWT.")
    ACCESS_TOKEN_EXPIRE_MINUTES: int = Field(default=60, ge=1, description="Validade do access token.")

    # ------------------------- Banco secundário (NoSQL) ---------------------
    # Usado pelo Double Backup. Se estiver indisponível, a API continua
    # funcionando: o PostgreSQL é a fonte da verdade e a falha só é logada.
    MONGO_URI: str = Field(default="mongodb://127.0.0.1:27017", description="URI do MongoDB.")
    MONGO_DB: str = Field(default="gastify", description="Banco usado pelo espelho.")
    MONGO_TIMEOUT_MS: int = Field(default=3000, ge=100, description="Timeout de seleção do servidor.")

    @property
    def database_url(self) -> str:
        """Monta a URL de conexão do PostgreSQL a partir das partes do .env.

        Retorna algo como:
            postgresql+psycopg://usuario:senha@localhost:5432/gastify

        `quote_plus` é aplicado em usuário e senha porque esses valores podem
        conter caracteres reservados de URL. A senha nunca é logada.
        """
        usuario = quote_plus(self.POSTGRES_USER)
        senha = quote_plus(self.POSTGRES_PASSWORD)
        credencial = f"{usuario}:{senha}" if self.POSTGRES_PASSWORD else usuario
        return (
            f"{DRIVER_POSTGRES}://{credencial}"
            f"@{self.POSTGRES_HOST}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"
        )

    @property
    def cors_origins_lista(self) -> list[str]:
        """Converte `CORS_ORIGINS` (string) em lista usada pelo CORSMiddleware.

        Aceita "*" (libera tudo, só para desenvolvimento) ou uma lista separada
        por vírgulas, ex.: "http://localhost:3000,http://10.0.2.2:8000"
        (10.0.2.2 é o host da máquina visto pelo emulador Android).
        """
        valor = self.CORS_ORIGINS.strip()
        if valor == "*":
            return ["*"]
        return [origem.strip() for origem in valor.split(",") if origem.strip()]

    @property
    def eh_producao(self) -> bool:
        """Atalho legível para checagens de ambiente em outras camadas."""
        return self.ENVIRONMENT.lower() == "production"


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Retorna a instância única de configuração (cache em memória).

    O `lru_cache` evita reler o .env a cada request/dependência — importante para
    manter o tempo de resposta baixo. Em testes, use
    `get_settings.cache_clear()` se precisar trocar variáveis de ambiente.
    """
    return Settings()
