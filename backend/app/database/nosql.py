"""Banco secundário (MongoDB) — espelho do PostgreSQL (Double Backup).

Regras do desenho (AGENTS.md, seção 3):
  * O PostgreSQL é a FONTE DA VERDADE. Toda escrita acontece nele primeiro.
  * Depois do commit, uma `BackgroundTask` do FastAPI replica a operação no
    MongoDB. A resposta HTTP volta sem esperar o NoSQL (performance).
  * Falha no NoSQL NUNCA desfaz a operação principal: é apenas logada, e o
    documento pode ser reprocessado depois.
  * O `_id` do documento é o mesmo UUID do registro relacional, então repetir a
    tarefa é idempotente (upsert por `_id`).

O cliente é criado de forma PREGUIÇOSA e com `connect=False`: importar este
módulo (ou subir a API) não abre conexão com o Mongo. Se o Mongo estiver fora,
a API continua respondendo normalmente.
"""

from __future__ import annotations

import logging
from typing import Any

from pymongo import MongoClient
from pymongo.collection import Collection
from pymongo.errors import PyMongoError

from app.core.config import get_settings

logger = logging.getLogger("gastify.nosql")

# Cliente único por processo (reaproveita o pool interno do pymongo).
_cliente: MongoClient | None = None


def get_cliente() -> MongoClient:
    """Cria (uma única vez) o cliente do MongoDB.

    `serverSelectionTimeoutMS` curto evita que uma tarefa em background fique
    pendurada por 30s quando o Mongo está fora — o objetivo é degradar rápido e
    continuar servindo o app.
    """
    global _cliente
    if _cliente is None:
        config = get_settings()
        _cliente = MongoClient(
            config.MONGO_URI,
            serverSelectionTimeoutMS=config.MONGO_TIMEOUT_MS,
            connect=False,  # conexão só na primeira operação
            tz_aware=True,
        )
    return _cliente


def get_colecao_gastos() -> Collection:
    """Coleção `gastos` do banco configurado no `.env`."""
    config = get_settings()
    return get_cliente()[config.MONGO_DB]["gastos"]


def espelhar_gasto(documento: dict[str, Any]) -> bool:
    """Faz upsert do documento do gasto no MongoDB.

    Retorna True/False para facilitar testes e métricas. `replace_one` com
    `upsert=True` garante idempotência: rodar a mesma tarefa duas vezes não
    duplica nada.
    """
    try:
        get_colecao_gastos().replace_one({"_id": documento["_id"]}, documento, upsert=True)
        return True
    except PyMongoError as erro:
        # Loga apenas o tipo: a mensagem do driver pode conter host/usuário.
        logger.warning("Double Backup falhou ao espelhar gasto (%s).", erro.__class__.__name__)
        return False


def remover_gasto(gasto_id: str) -> bool:
    """Remove o espelho de um gasto excluído no PostgreSQL (idempotente)."""
    try:
        get_colecao_gastos().delete_one({"_id": gasto_id})
        return True
    except PyMongoError as erro:
        logger.warning("Double Backup falhou ao remover gasto (%s).", erro.__class__.__name__)
        return False


def verificar_conexao() -> bool:
    """Ping no MongoDB (usado pelo `/health` e por testes de integração).

    Nunca lança: banco secundário fora é um estado esperado (degrada para
    "unavailable" sem derrubar a API).
    """
    try:
        get_cliente().admin.command("ping")
        return True
    except Exception as erro:  # noqa: BLE001 - health check não pode explodir
        logger.warning("MongoDB indisponível: %s", erro.__class__.__name__)
        return False


def fechar_cliente() -> None:
    """Fecha o pool do Mongo no shutdown da aplicação."""
    global _cliente
    if _cliente is not None:
        _cliente.close()
        _cliente = None
