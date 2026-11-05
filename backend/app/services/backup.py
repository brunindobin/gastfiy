"""Double Backup — monta o documento espelho e delega ao MongoDB.

Este módulo é o "meio de campo" entre a operação relacional e o NoSQL:
  * `documento_do_gasto` serializa o ORM em um dict simples (sem sessão aberta);
  * `espelhar`/`remover_espelho` são chamados como `BackgroundTask`, ou seja,
    depois da resposta HTTP — o app não paga a latência do segundo banco.

Se o MongoDB estiver fora, a função apenas retorna False e loga um aviso: a
operação principal (PostgreSQL) já foi confirmada e não é desfeita.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any

from app.database import nosql
from app.models import Gasto

logger = logging.getLogger("gastify.backup")


def documento_do_gasto(gasto: Gasto) -> dict[str, Any]:
    """Converte o gasto em documento pronto para o MongoDB.

    Formato escolhido para facilitar consultas futuras e reconciliação:
      * `_id`/`id` = UUID em texto (idempotência do upsert);
      * `valor` numérico (mesmo tipo do JSON da API);
      * `data` em ISO `AAAA-MM-DD` (comparável como string);
      * `espelhado_em` registra quando a cópia foi feita.
    """
    return {
        "_id": str(gasto.id),
        "id": str(gasto.id),
        "usuario_id": str(gasto.usuario_id),
        "nome": gasto.nome,
        "valor": float(gasto.valor),
        "data": gasto.data.isoformat(),
        "categoria": gasto.categoria.value,
        "categoria_rotulo": gasto.categoria.rotulo,
        "criado_em": gasto.criado_em.isoformat(),
        "atualizado_em": gasto.atualizado_em.isoformat(),
        "espelhado_em": datetime.now(timezone.utc).isoformat(),
    }


def espelhar(documento: dict[str, Any]) -> bool:
    """Upsert do documento no MongoDB (chamado em background).

    O `except Exception` amplo é intencional: esta função roda DEPOIS da
    resposta HTTP. Se algo inesperado estourar aqui, o Starlette registraria o
    erro no log mas o app já recebeu sucesso — o que queremos é justamente
    registrar e seguir (o PostgreSQL é a fonte da verdade).
    """
    try:
        ok = nosql.espelhar_gasto(documento)
    except Exception as erro:  # noqa: BLE001 - backup nunca pode quebrar a request
        logger.warning("Double Backup inesperado ao espelhar (%s).", erro.__class__.__name__)
        return False

    if ok:
        logger.debug("Double Backup: gasto %s espelhado.", documento.get("_id"))
    return ok


def remover_espelho(gasto_id: str) -> bool:
    """Remove o documento do MongoDB após um DELETE (chamado em background)."""
    try:
        ok = nosql.remover_gasto(gasto_id)
    except Exception as erro:  # noqa: BLE001 - idem acima
        logger.warning("Double Backup inesperado ao remover (%s).", erro.__class__.__name__)
        return False

    if ok:
        logger.debug("Double Backup: espelho do gasto %s removido.", gasto_id)
    return ok
