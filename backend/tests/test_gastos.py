"""Testes de integração do CRUD de gastos: filtros, paginação e isolamento.

Usam PostgreSQL real (banco `gastify_teste`) e cobrem exatamente o que o app
consome: home (gastos do dia), filtros por categoria/busca, paginação e
proteção contra acesso a dados de outra conta.
"""

from __future__ import annotations

import uuid
from datetime import date, timedelta

HOJE = date.today()
ONTEM = HOJE - timedelta(days=1)


def _criar(cliente, cabecalhos, **ajustes):
    """Atalho para criar gasto com payload válido + sobrescritas."""
    payload = {"nome": "Café", "valor": 12.5, "data": HOJE.isoformat()}
    payload.update(ajustes)
    return cliente.post("/api/v1/gastos", json=payload, headers=cabecalhos)


# ---------------------------------------------------------------------------
# Criação
# ---------------------------------------------------------------------------
def test_criar_gasto_retorna_201_com_contrato_completo(cliente, cabecalhos) -> None:
    resposta = _criar(cliente, cabecalhos, nome="Aluguel", valor=1500, categoria="gastos_obrigatorios")

    assert resposta.status_code == 201
    corpo = resposta.json()
    assert corpo["nome"] == "Aluguel"
    assert corpo["valor"] == 1500.0
    assert corpo["data"] == HOJE.isoformat()
    assert corpo["categoria"] == "gastos_obrigatorios"
    assert corpo["categoria_rotulo"] == "Gastos Obrigatórios"
    assert corpo["id"]


def test_criar_sem_token_retorna_401(cliente) -> None:
    resposta = cliente.post(
        "/api/v1/gastos",
        json={"nome": "Sem dono", "valor": 10, "data": HOJE.isoformat()},
    )

    assert resposta.status_code == 401


def test_criar_com_valor_invalido_retorna_422(cliente, cabecalhos) -> None:
    """Valor zero/negativo e data futura são barrados antes do banco."""
    valor_zero = _criar(cliente, cabecalhos, valor=0)
    data_futura = _criar(cliente, cabecalhos, data=(HOJE + timedelta(days=1)).isoformat())

    assert valor_zero.status_code == 422
    assert data_futura.status_code == 422
    assert valor_zero.json()["codigo"] == "VALIDACAO"


# ---------------------------------------------------------------------------
# Listagem / filtros / paginação
# ---------------------------------------------------------------------------
def test_lista_apenas_gastos_do_dia(cliente, cabecalhos) -> None:
    """A home pede ?data=... e recebe somente aquele dia."""
    _criar(cliente, cabecalhos, nome="Hoje 1")
    _criar(cliente, cabecalhos, nome="Hoje 2")
    _criar(cliente, cabecalhos, nome="Ontem", data=ONTEM.isoformat())

    resposta = cliente.get(f"/api/v1/gastos?data={HOJE.isoformat()}", headers=cabecalhos)

    assert resposta.status_code == 200
    corpo = resposta.json()
    assert corpo["total"] == 2
    assert {item["nome"] for item in corpo["itens"]} == {"Hoje 1", "Hoje 2"}


def test_filtra_por_multiplas_categorias(cliente, cabecalhos) -> None:
    _criar(cliente, cabecalhos, categoria="lazer")
    _criar(cliente, cabecalhos, categoria="saude")
    _criar(cliente, cabecalhos, categoria="transporte")

    resposta = cliente.get(
        "/api/v1/gastos?categoria=lazer&categoria=saude",
        headers=cabecalhos,
    )

    assert resposta.status_code == 200
    assert resposta.json()["total"] == 2


def test_busca_por_trecho_do_nome(cliente, cabecalhos) -> None:
    _criar(cliente, cabecalhos, nome="Uber para o trabalho")
    _criar(cliente, cabecalhos, nome="Padaria")

    resposta = cliente.get("/api/v1/gastos?busca=uber", headers=cabecalhos)

    assert resposta.status_code == 200
    assert resposta.json()["total"] == 1
    assert resposta.json()["itens"][0]["nome"] == "Uber para o trabalho"


def test_paginacao_respeita_limite_e_offset(cliente, cabecalhos) -> None:
    for indice in range(5):
        _criar(cliente, cabecalhos, nome=f"Gasto {indice}")

    primeira = cliente.get("/api/v1/gastos?limite=2&offset=0", headers=cabecalhos).json()
    ultima = cliente.get("/api/v1/gastos?limite=2&offset=4", headers=cabecalhos).json()

    assert primeira["total"] == 5
    assert len(primeira["itens"]) == 2
    assert len(ultima["itens"]) == 1


def test_intervalo_invertido_retorna_422(cliente, cabecalhos) -> None:
    resposta = cliente.get(
        f"/api/v1/gastos?data_inicio={HOJE.isoformat()}&data_fim={ONTEM.isoformat()}",
        headers=cabecalhos,
    )

    assert resposta.status_code == 422
    assert resposta.json()["codigo"] == "INTERVALO_INVALIDO"


def test_ordenacao_mais_recente_primeiro(cliente, cabecalhos) -> None:
    _criar(cliente, cabecalhos, nome="Antigo", data=ONTEM.isoformat())
    _criar(cliente, cabecalhos, nome="Novo", data=HOJE.isoformat())

    itens = cliente.get("/api/v1/gastos", headers=cabecalhos).json()["itens"]

    assert itens[0]["nome"] == "Novo"


# ---------------------------------------------------------------------------
# Detalhe / atualização / remoção
# ---------------------------------------------------------------------------
def test_obter_por_id(cliente, cabecalhos) -> None:
    criado = _criar(cliente, cabecalhos).json()

    resposta = cliente.get(f"/api/v1/gastos/{criado['id']}", headers=cabecalhos)

    assert resposta.status_code == 200
    assert resposta.json()["id"] == criado["id"]


def test_id_inexistente_retorna_404(cliente, cabecalhos) -> None:
    resposta = cliente.get(f"/api/v1/gastos/{uuid.uuid4()}", headers=cabecalhos)

    assert resposta.status_code == 404
    assert resposta.json()["codigo"] == "GASTO_NAO_ENCONTRADO"


def test_atualizacao_parcial_preserva_campos_nao_enviados(cliente, cabecalhos) -> None:
    criado = _criar(cliente, cabecalhos, nome="Mercado", valor=100).json()

    resposta = cliente.put(
        f"/api/v1/gastos/{criado['id']}",
        json={"valor": 120.75},
        headers=cabecalhos,
    )

    assert resposta.status_code == 200
    assert resposta.json()["valor"] == 120.75
    assert resposta.json()["nome"] == "Mercado"


def test_atualizacao_vazia_retorna_422(cliente, cabecalhos) -> None:
    criado = _criar(cliente, cabecalhos).json()

    resposta = cliente.put(f"/api/v1/gastos/{criado['id']}", json={}, headers=cabecalhos)

    assert resposta.status_code == 422
    assert resposta.json()["codigo"] == "CORPO_VAZIO"


def test_remover_gasto(cliente, cabecalhos) -> None:
    criado = _criar(cliente, cabecalhos).json()

    remocao = cliente.delete(f"/api/v1/gastos/{criado['id']}", headers=cabecalhos)
    busca = cliente.get(f"/api/v1/gastos/{criado['id']}", headers=cabecalhos)

    assert remocao.status_code == 204
    assert remocao.content == b""
    assert busca.status_code == 404


# ---------------------------------------------------------------------------
# Isolamento entre usuários
# ---------------------------------------------------------------------------
def test_usuario_nao_acessa_gasto_de_outro(cliente, cabecalhos, outro_usuario) -> None:
    """Mesmo com o UUID em mãos, a resposta é 404 (não revela existência)."""
    _, cabecalhos_outro = outro_usuario
    criado = _criar(cliente, cabecalhos, nome="Meu gasto").json()

    leitura = cliente.get(f"/api/v1/gastos/{criado['id']}", headers=cabecalhos_outro)
    remocao = cliente.delete(f"/api/v1/gastos/{criado['id']}", headers=cabecalhos_outro)

    assert leitura.status_code == 404
    assert remocao.status_code == 404


def test_listagem_e_isolada_por_usuario(cliente, cabecalhos, outro_usuario) -> None:
    _, cabecalhos_outro = outro_usuario
    _criar(cliente, cabecalhos, nome="Só meu")

    resposta = cliente.get("/api/v1/gastos", headers=cabecalhos_outro)

    assert resposta.status_code == 200
    assert resposta.json()["total"] == 0
