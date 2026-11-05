"""Testes de integração das agregações do dashboard.

Validam o contrato que o app consome: totais do dia, série mensal (dias sem
gasto zerados), série anual (12 meses) e quebra por categoria — sempre isolados
por usuário.
"""

from __future__ import annotations

import calendar
from datetime import date, timedelta

HOJE = date.today()
MES_ANTERIOR = (HOJE.replace(day=1) - timedelta(days=1))


def _criar(cliente, cabecalhos, nome, valor, dia, categoria="outros"):
    resposta = cliente.post(
        "/api/v1/gastos",
        json={
            "nome": nome,
            "valor": valor,
            "data": dia.isoformat(),
            "categoria": categoria,
        },
        headers=cabecalhos,
    )
    assert resposta.status_code == 201, resposta.text
    return resposta.json()


def test_resumo_do_dia_soma_e_quebra_por_categoria(cliente, cabecalhos) -> None:
    _criar(cliente, cabecalhos, "Cinema", 30, HOJE, "lazer")
    _criar(cliente, cabecalhos, "Farmácia", 20, HOJE, "saude")

    resposta = cliente.get(f"/api/v1/agregacoes/resumo?data={HOJE.isoformat()}", headers=cabecalhos)

    assert resposta.status_code == 200
    corpo = resposta.json()
    assert corpo["total"] == 50.0
    assert corpo["quantidade"] == 2
    assert {item["categoria"] for item in corpo["por_categoria"]} == {"lazer", "saude"}


def test_resumo_sem_data_usa_hoje(cliente, cabecalhos) -> None:
    _criar(cliente, cabecalhos, "Padaria", 8.5, HOJE, "alimentacao")

    corpo = cliente.get("/api/v1/agregacoes/resumo", headers=cabecalhos).json()

    assert corpo["data"] == HOJE.isoformat()
    assert corpo["total"] == 8.5


def test_mensal_preenche_todos_os_dias_do_mes(cliente, cabecalhos) -> None:
    _criar(cliente, cabecalhos, "Mercado", 100, HOJE, "alimentacao")
    _criar(cliente, cabecalhos, "Uber", 25, HOJE, "transporte")

    resposta = cliente.get(
        f"/api/v1/agregacoes/mensal?ano={HOJE.year}&mes={HOJE.month}",
        headers=cabecalhos,
    )

    assert resposta.status_code == 200
    corpo = resposta.json()
    assert corpo["total"] == 125.0
    assert corpo["quantidade"] == 2

    dias_no_mes = calendar.monthrange(HOJE.year, HOJE.month)[1]
    assert len(corpo["por_dia"]) == dias_no_mes
    # Dias sem gasto vêm zerados; a soma da série bate com o total.
    assert sum(item["total"] for item in corpo["por_dia"]) == 125.0
    assert len(corpo["por_categoria"]) == 2


def test_mensal_nao_mistura_meses(cliente, cabecalhos) -> None:
    """Gasto do mês anterior não entra no total do mês atual."""
    _criar(cliente, cabecalhos, "Do mês passado", 999, MES_ANTERIOR, "outros")
    _criar(cliente, cabecalhos, "Deste mês", 10, HOJE, "outros")

    corpo = cliente.get(
        f"/api/v1/agregacoes/mensal?ano={HOJE.year}&mes={HOJE.month}",
        headers=cabecalhos,
    ).json()

    assert corpo["total"] == 10.0


def test_anual_devolve_doze_meses_e_total_correto(cliente, cabecalhos) -> None:
    _criar(cliente, cabecalhos, "Janeiro", 300, date(HOJE.year, 1, 15), "saude")
    _criar(cliente, cabecalhos, "Hoje", 50, HOJE, "lazer")

    resposta = cliente.get(f"/api/v1/agregacoes/anual?ano={HOJE.year}", headers=cabecalhos)

    assert resposta.status_code == 200
    corpo = resposta.json()
    assert len(corpo["por_mes"]) == 12
    assert sum(item["total"] for item in corpo["por_mes"]) == 350.0
    assert corpo["total"] == 350.0


def test_categorias_respeita_intervalo(cliente, cabecalhos) -> None:
    _criar(cliente, cabecalhos, "Dentro", 40, HOJE, "lazer")
    _criar(cliente, cabecalhos, "Fora", 60, MES_ANTERIOR, "lazer")

    corpo = cliente.get(
        f"/api/v1/agregacoes/categorias?data_inicio={HOJE.isoformat()}&data_fim={HOJE.isoformat()}",
        headers=cabecalhos,
    ).json()

    assert corpo["total"] == 40.0
    assert corpo["por_categoria"][0]["categoria"] == "lazer"
    assert corpo["por_categoria"][0]["rotulo"] == "Lazer"


def test_intervalo_invertido_retorna_422(cliente, cabecalhos) -> None:
    resposta = cliente.get(
        f"/api/v1/agregacoes/categorias?data_inicio={HOJE.isoformat()}&data_fim={MES_ANTERIOR.isoformat()}",
        headers=cabecalhos,
    )

    assert resposta.status_code == 422
    assert resposta.json()["codigo"] == "INTERVALO_INVALIDO"


def test_mes_invalido_retorna_422(cliente, cabecalhos) -> None:
    resposta = cliente.get(f"/api/v1/agregacoes/mensal?ano=2026&mes=13", headers=cabecalhos)

    assert resposta.status_code == 422


def test_agregacoes_sem_token_retornam_401(cliente) -> None:
    resposta = cliente.get("/api/v1/agregacoes/anual?ano=2026")

    assert resposta.status_code == 401


def test_agregacoes_sao_isoladas_por_usuario(cliente, cabecalhos, outro_usuario) -> None:
    """O total de um usuário nunca inclui gastos de outro."""
    _, cabecalhos_outro = outro_usuario
    _criar(cliente, cabecalhos, "Meu", 100, HOJE, "lazer")

    corpo = cliente.get(f"/api/v1/agregacoes/anual?ano={HOJE.year}", headers=cabecalhos_outro).json()

    assert corpo["total"] == 0.0
    assert corpo["por_categoria"] == []
