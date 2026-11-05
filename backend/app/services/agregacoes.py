"""Agregações para o dashboard (mensal, anual e por categoria).

Todas as somas são feitas NO BANCO (SQL `SUM`/`COUNT`), não em Python:
  * `Numeric` no PostgreSQL não perde precisão (diferente de float);
  * trafega apenas o resultado agregado, não todos os gastos — o dashboard
    responde rápido mesmo com histórico grande.

Sempre filtrado por `usuario_id`: ninguém vê o total de outra conta.

Convenção de saída (ver `docs/API.md`):
  * `total` como número JSON (2 casas);
  * `por_dia`/`por_mes` preenchidos com ZERO nos períodos sem gasto, para o
    gráfico do app não precisar completar lacunas.
"""

from __future__ import annotations

import calendar
import uuid
from datetime import date

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import CategoriaGasto, Gasto


def _soma_e_quantidade():
    """Expressões reutilizadas de soma (coalesce evita None) e contagem."""
    return func.coalesce(func.sum(Gasto.valor), 0), func.count(Gasto.id)


def _filtrar_periodo(consulta, inicio: date | None, fim: date | None):
    """Aplica o intervalo de datas (inclusive nas duas pontas)."""
    if inicio is not None:
        consulta = consulta.where(Gasto.data >= inicio)
    if fim is not None:
        consulta = consulta.where(Gasto.data <= fim)
    return consulta


def _total_e_quantidade(
    db: Session,
    usuario_id: uuid.UUID,
    inicio: date | None = None,
    fim: date | None = None,
) -> tuple[float, int]:
    """Soma e quantidade de gastos no período (uma única query)."""
    soma, quantidade = _soma_e_quantidade()
    consulta = _filtrar_periodo(
        select(soma, quantidade).where(Gasto.usuario_id == usuario_id), inicio, fim
    )
    total, qtd = db.execute(consulta).one()
    return float(total or 0), int(qtd or 0)


def _por_categoria(
    db: Session,
    usuario_id: uuid.UUID,
    inicio: date | None = None,
    fim: date | None = None,
) -> list[dict]:
    """Totais por categoria, do maior para o menor (ordem dos gráficos)."""
    soma, quantidade = _soma_e_quantidade()
    consulta = _filtrar_periodo(
        select(
            Gasto.categoria,
            soma.label("total"),
            quantidade.label("quantidade"),
        ).where(Gasto.usuario_id == usuario_id),
        inicio,
        fim,
    ).group_by(Gasto.categoria).order_by(soma.desc())

    return [
        {
            "categoria": categoria.value,
            "rotulo": categoria.rotulo,
            "total": float(total or 0),
            "quantidade": int(qtd or 0),
        }
        for categoria, total, qtd in db.execute(consulta).all()
    ]


def resumo_dia(db: Session, usuario_id: uuid.UUID, dia: date) -> dict:
    """Resumo da home: total do dia + quebra por categoria."""
    total, quantidade = _total_e_quantidade(db, usuario_id, dia, dia)
    return {
        "data": dia.isoformat(),
        "total": total,
        "quantidade": quantidade,
        "por_categoria": _por_categoria(db, usuario_id, dia, dia),
    }


def mensal(db: Session, usuario_id: uuid.UUID, ano: int, mes: int) -> dict:
    """Série do mês: total, por categoria e por dia (dias sem gasto = 0)."""
    ultimo_dia = calendar.monthrange(ano, mes)[1]
    inicio, fim = date(ano, mes, 1), date(ano, mes, ultimo_dia)

    total, quantidade = _total_e_quantidade(db, usuario_id, inicio, fim)

    soma, qtd = _soma_e_quantidade()
    consulta_dias = _filtrar_periodo(
        select(Gasto.data, soma.label("total"), qtd.label("quantidade")).where(
            Gasto.usuario_id == usuario_id
        ),
        inicio,
        fim,
    ).group_by(Gasto.data).order_by(Gasto.data)

    # Dicionário dia -> (total, quantidade) para preencher o mês inteiro.
    por_data = {linha[0]: (float(linha[1] or 0), int(linha[2] or 0)) for linha in db.execute(consulta_dias)}
    por_dia = [
        {
            "dia": date(ano, mes, dia).isoformat(),
            "total": por_data.get(date(ano, mes, dia), (0.0, 0))[0],
            "quantidade": por_data.get(date(ano, mes, dia), (0.0, 0))[1],
        }
        for dia in range(1, ultimo_dia + 1)
    ]

    return {
        "ano": ano,
        "mes": mes,
        "total": total,
        "quantidade": quantidade,
        "por_categoria": _por_categoria(db, usuario_id, inicio, fim),
        "por_dia": por_dia,
    }


def anual(db: Session, usuario_id: uuid.UUID, ano: int) -> dict:
    """Série do ano: total, por categoria e por mês (meses vazios = 0)."""
    inicio, fim = date(ano, 1, 1), date(ano, 12, 31)
    total, quantidade = _total_e_quantidade(db, usuario_id, inicio, fim)

    soma, qtd = _soma_e_quantidade()
    consulta_meses = _filtrar_periodo(
        select(
            func.date_part("month", Gasto.data).label("mes"),
            soma.label("total"),
            qtd.label("quantidade"),
        ).where(Gasto.usuario_id == usuario_id),
        inicio,
        fim,
    ).group_by("mes").order_by("mes")

    por_mes_dados = {int(linha[0]): (float(linha[1] or 0), int(linha[2] or 0)) for linha in db.execute(consulta_meses)}
    por_mes = [
        {
            "mes": mes,
            "total": por_mes_dados.get(mes, (0.0, 0))[0],
            "quantidade": por_mes_dados.get(mes, (0.0, 0))[1],
        }
        for mes in range(1, 13)
    ]

    return {
        "ano": ano,
        "total": total,
        "quantidade": quantidade,
        "por_mes": por_mes,
        "por_categoria": _por_categoria(db, usuario_id, inicio, fim),
    }


def por_categoria(
    db: Session,
    usuario_id: uuid.UUID,
    inicio: date | None = None,
    fim: date | None = None,
) -> dict:
    """Totais por categoria em um intervalo livre (ou em todo o histórico)."""
    total, _ = _total_e_quantidade(db, usuario_id, inicio, fim)
    return {
        "total": total,
        "por_categoria": _por_categoria(db, usuario_id, inicio, fim),
    }


# Reexportado para uso em testes/tipagem sem depender do import interno.
__all__ = ["resumo_dia", "mensal", "anual", "por_categoria", "CategoriaGasto"]
