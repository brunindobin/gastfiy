"""Serviço de gastos: CRUD, filtros e paginação — sempre isolado por usuário.

Por que a camada de serviço existe:
  * o router não deve conhecer transação nem query;
  * TODA consulta começa com `usuario_id == dono`, garantindo que ninguém leia
    ou altere gasto de outra conta (mesmo sabendo o UUID);
  * a listagem usa `total` + `itens` (envelope) para o app paginar sem quebrar
    contrato — ver `docs/API.md`.
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass, field
from datetime import date

from sqlalchemy import func, select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.core.exceptions import ErroNaoEncontrado, ErroValidacaoNegocio
from app.models import CategoriaGasto, Gasto
from app.schemas.gasto import GastoCreate, GastoUpdate


@dataclass(frozen=True)
class FiltrosGastos:
    """Filtros aceitos pela listagem (todos opcionais).

    `frozen=True` evita que um filtro seja alterado por engano depois de
    montado, mantendo a consulta previsível.
    """

    data: date | None = None
    data_inicio: date | None = None
    data_fim: date | None = None
    categorias: tuple[CategoriaGasto, ...] = field(default_factory=tuple)
    busca: str | None = None


def _consulta_base(usuario_id: uuid.UUID):
    """Seleção já restrita ao dono — ponto único de isolamento de dados."""
    return select(Gasto).where(Gasto.usuario_id == usuario_id)


def _aplicar_filtros(consulta, filtros: FiltrosGastos):
    """Aplica os filtros de data/categoria/busca (todos parametrizados).

    `data` tem precedência sobre o intervalo (a home pede um dia específico).
    O `ilike` é apenas um LIKE parametrizado pelo driver — nada de concatenar
    SQL, portanto imune a injeção.
    """
    if filtros.data is not None:
        consulta = consulta.where(Gasto.data == filtros.data)
    else:
        if filtros.data_inicio is not None:
            consulta = consulta.where(Gasto.data >= filtros.data_inicio)
        if filtros.data_fim is not None:
            consulta = consulta.where(Gasto.data <= filtros.data_fim)

    if filtros.categorias:
        consulta = consulta.where(Gasto.categoria.in_(filtros.categorias))

    if filtros.busca:
        termo = filtros.busca.strip()
        if termo:
            consulta = consulta.where(Gasto.nome.ilike(f"%{termo}%"))

    return consulta


def listar(
    db: Session,
    usuario_id: uuid.UUID,
    filtros: FiltrosGastos,
    limite: int,
    offset: int,
) -> tuple[int, list[Gasto]]:
    """Devolve `(total, página_de_gastos)` respeitando os filtros.

    O `total` é contado sobre a MESMA consulta filtrada (subquery) para o app
    saber quantas páginas existem — não é o total de registros do usuário.
    """
    if filtros.data_inicio and filtros.data_fim and filtros.data_inicio > filtros.data_fim:
        raise ErroValidacaoNegocio(
            "A data inicial não pode ser posterior à data final.",
            codigo="INTERVALO_INVALIDO",
        )

    consulta = _aplicar_filtros(_consulta_base(usuario_id), filtros)

    total = db.scalar(select(func.count()).select_from(consulta.subquery())) or 0

    # Ordem estável: data mais recente primeiro e, no mesmo dia, o último
    # lançamento primeiro (o que o usuário acabou de cadastrar aparece no topo).
    itens = list(
        db.scalars(
            consulta.order_by(Gasto.data.desc(), Gasto.criado_em.desc())
            .limit(limite)
            .offset(offset)
        ).all()
    )
    return int(total), itens


def obter(db: Session, usuario_id: uuid.UUID, gasto_id: uuid.UUID) -> Gasto:
    """Busca um gasto do usuário; 404 se não existir OU se for de outra conta.

    Devolver o mesmo 404 nos dois casos evita que alguém descubra a existência
    de registros alheios (enumeração por UUID).
    """
    gasto = db.scalar(
        select(Gasto).where(Gasto.id == gasto_id, Gasto.usuario_id == usuario_id)
    )
    if gasto is None:
        raise ErroNaoEncontrado("Gasto não encontrado.", codigo="GASTO_NAO_ENCONTRADO")
    return gasto


def criar(db: Session, usuario_id: uuid.UUID, dados: GastoCreate) -> Gasto:
    """Persiste um gasto novo (validação já feita pelo Pydantic)."""
    gasto = Gasto(usuario_id=usuario_id, **dados.model_dump())
    db.add(gasto)
    try:
        db.commit()
    except SQLAlchemyError:
        db.rollback()
        raise
    db.refresh(gasto)
    return gasto


def atualizar(
    db: Session,
    usuario_id: uuid.UUID,
    gasto_id: uuid.UUID,
    dados: GastoUpdate,
) -> Gasto:
    """Atualização parcial: só os campos enviados são alterados.

    `exclude_unset=True` é o que garante o comportamento parcial — campos
    ausentes não sobrescrevem o valor atual com None.
    """
    alteracoes = dados.model_dump(exclude_unset=True)
    if not alteracoes:
        raise ErroValidacaoNegocio(
            "Nenhum campo para atualizar.",
            codigo="CORPO_VAZIO",
        )

    gasto = obter(db, usuario_id, gasto_id)
    for campo, valor in alteracoes.items():
        setattr(gasto, campo, valor)

    try:
        db.commit()
    except SQLAlchemyError:
        db.rollback()
        raise
    db.refresh(gasto)
    return gasto


def remover(db: Session, usuario_id: uuid.UUID, gasto_id: uuid.UUID) -> None:
    """Exclui o gasto do usuário (404 se não for dele)."""
    gasto = obter(db, usuario_id, gasto_id)
    db.delete(gasto)
    try:
        db.commit()
    except SQLAlchemyError:
        db.rollback()
        raise
