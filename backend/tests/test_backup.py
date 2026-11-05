"""Testes do Double Backup (PostgreSQL -> MongoDB).

O que precisa ser verdade:
  * POST cria o documento espelho com o MESMO id do registro relacional;
  * PUT atualiza o documento (sem duplicar);
  * DELETE remove o documento;
  * repetir a tarefa não duplica (idempotência do upsert);
  * Mongo fora do ar NÃO derruba a operação principal.

Os testes que dependem do Mongo são pulados automaticamente se ele não estiver
rodando (fixture `colecao_mongo`).
"""

from __future__ import annotations

import uuid
from datetime import date

from app.services import backup

HOJE = date.today()


def test_post_cria_documento_espelho(cliente, cabecalhos, colecao_mongo) -> None:
    criado = cliente.post(
        "/api/v1/gastos",
        json={
            "nome": "Cinema",
            "valor": 45.9,
            "data": HOJE.isoformat(),
            "categoria": "lazer",
        },
        headers=cabecalhos,
    ).json()

    # O TestClient executa as BackgroundTasks antes de devolver a resposta,
    # então o documento já está no Mongo neste ponto.
    documento = colecao_mongo.find_one({"_id": criado["id"]})

    assert documento is not None
    assert documento["id"] == criado["id"]
    assert documento["nome"] == "Cinema"
    assert documento["valor"] == 45.9
    assert documento["data"] == HOJE.isoformat()
    assert documento["categoria"] == "lazer"
    assert documento["usuario_id"]
    assert documento["espelhado_em"]


def test_put_atualiza_o_mesmo_documento(cliente, cabecalhos, colecao_mongo) -> None:
    criado = cliente.post(
        "/api/v1/gastos",
        json={"nome": "Mercado", "valor": 100, "data": HOJE.isoformat()},
        headers=cabecalhos,
    ).json()

    cliente.put(
        f"/api/v1/gastos/{criado['id']}",
        json={"valor": 150.5, "nome": "Mercado Grande"},
        headers=cabecalhos,
    )

    documento = colecao_mongo.find_one({"_id": criado["id"]})
    assert documento["valor"] == 150.5
    assert documento["nome"] == "Mercado Grande"
    # Upsert por _id: continua existindo um único documento.
    assert colecao_mongo.count_documents({"_id": criado["id"]}) == 1


def test_delete_remove_o_documento(cliente, cabecalhos, colecao_mongo) -> None:
    criado = cliente.post(
        "/api/v1/gastos",
        json={"nome": "Temporário", "valor": 10, "data": HOJE.isoformat()},
        headers=cabecalhos,
    ).json()
    assert colecao_mongo.find_one({"_id": criado["id"]}) is not None

    cliente.delete(f"/api/v1/gastos/{criado['id']}", headers=cabecalhos)

    assert colecao_mongo.find_one({"_id": criado["id"]}) is None


def test_espelho_e_idempotente(colecao_mongo) -> None:
    """Rodar a mesma tarefa duas vezes não cria documento duplicado."""
    documento = {
        "_id": str(uuid.uuid4()),
        "id": "x",
        "usuario_id": str(uuid.uuid4()),
        "nome": "Repetido",
        "valor": 1.0,
        "data": HOJE.isoformat(),
        "categoria": "outros",
        "categoria_rotulo": "Outros",
        "criado_em": "2026-01-01T00:00:00+00:00",
        "atualizado_em": "2026-01-01T00:00:00+00:00",
        "espelhado_em": "2026-01-01T00:00:00+00:00",
    }

    assert backup.espelhar(documento) is True
    assert backup.espelhar(documento) is True

    assert colecao_mongo.count_documents({"_id": documento["_id"]}) == 1


def test_falha_no_nosql_nao_quebra_a_api(cliente, cabecalhos, monkeypatch) -> None:
    """Se o Mongo explodir, o POST continua 201 (PostgreSQL é a verdade)."""

    def explodir(_: dict) -> bool:
        raise RuntimeError("mongo fora do ar")

    monkeypatch.setattr("app.services.backup.nosql.espelhar_gasto", explodir)

    resposta = cliente.post(
        "/api/v1/gastos",
        json={"nome": "Resiliente", "valor": 5, "data": HOJE.isoformat()},
        headers=cabecalhos,
    )

    assert resposta.status_code == 201
