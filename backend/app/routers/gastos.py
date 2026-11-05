"""Router do recurso `Gasto` — CRUD completo, filtros e paginação.

Todas as rotas exigem JWT (`Depends(obter_usuario_atual)`) e só enxergam dados
do próprio usuário. Depois de cada escrita, o espelho no MongoDB é enfileirado
em `BackgroundTasks` (Double Backup) — a resposta não espera o NoSQL.
"""

from __future__ import annotations

import uuid
from datetime import date

from fastapi import APIRouter, BackgroundTasks, Depends, Query, Response, status
from sqlalchemy.orm import Session

from app.core.security import obter_usuario_atual
from app.database.session import get_db
from app.models import CategoriaGasto, Gasto, Usuario
from app.schemas.gasto import GastoCreate, GastoLista, GastoRead, GastoUpdate
from app.services import backup
from app.services import gastos as servico_gastos

router = APIRouter(tags=["gastos"])


@router.post(
    "",
    status_code=status.HTTP_201_CREATED,
    response_model=GastoRead,
    summary="Cria um gasto",
)
def criar_gasto(
    dados: GastoCreate,
    tarefas: BackgroundTasks,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(obter_usuario_atual),
) -> Gasto:
    """Grava no PostgreSQL e agenda o espelho no MongoDB."""
    gasto = servico_gastos.criar(db, usuario.id, dados)
    # O documento é montado AQUI (sessão ainda aberta) e a tarefa só envia dict.
    tarefas.add_task(backup.espelhar, backup.documento_do_gasto(gasto))
    return gasto


@router.get(
    "",
    response_model=GastoLista,
    summary="Lista gastos com filtros e paginação",
)
def listar_gastos(
    data: date | None = Query(default=None, description="Gastos de um dia específico."),
    data_inicio: date | None = Query(default=None, description="Início do intervalo (inclusive)."),
    data_fim: date | None = Query(default=None, description="Fim do intervalo (inclusive)."),
    categoria: list[CategoriaGasto] | None = Query(
        default=None,
        description="Uma ou mais categorias (parâmetro repetível).",
    ),
    busca: str | None = Query(default=None, max_length=120, description="Trecho do nome."),
    limite: int = Query(default=50, ge=1, le=200, description="Itens por página."),
    offset: int = Query(default=0, ge=0, description="Itens a pular."),
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(obter_usuario_atual),
) -> GastoLista:
    """Listagem usada pela home (filtro por dia), filtros e paginação."""
    filtros = servico_gastos.FiltrosGastos(
        data=data,
        data_inicio=data_inicio,
        data_fim=data_fim,
        categorias=tuple(categoria or ()),
        busca=busca,
    )
    total, itens = servico_gastos.listar(db, usuario.id, filtros, limite, offset)
    return GastoLista(total=total, itens=[GastoRead.model_validate(item) for item in itens])


@router.get(
    "/{gasto_id}",
    response_model=GastoRead,
    summary="Detalhe de um gasto",
    responses={404: {"description": "Gasto não encontrado."}},
)
def obter_gasto(
    gasto_id: uuid.UUID,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(obter_usuario_atual),
) -> Gasto:
    """404 também quando o gasto pertence a outro usuário (não vaza existência)."""
    return servico_gastos.obter(db, usuario.id, gasto_id)


@router.put(
    "/{gasto_id}",
    response_model=GastoRead,
    summary="Atualiza um gasto (parcial)",
    responses={404: {"description": "Gasto não encontrado."}},
)
def atualizar_gasto(
    gasto_id: uuid.UUID,
    dados: GastoUpdate,
    tarefas: BackgroundTasks,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(obter_usuario_atual),
) -> Gasto:
    """Envie apenas os campos alterados; o espelho é atualizado em background."""
    gasto = servico_gastos.atualizar(db, usuario.id, gasto_id, dados)
    tarefas.add_task(backup.espelhar, backup.documento_do_gasto(gasto))
    return gasto


@router.delete(
    "/{gasto_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Remove um gasto",
    responses={404: {"description": "Gasto não encontrado."}},
)
def remover_gasto(
    gasto_id: uuid.UUID,
    tarefas: BackgroundTasks,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(obter_usuario_atual),
) -> Response:
    """204 sem corpo; o espelho no MongoDB é removido em background."""
    servico_gastos.remover(db, usuario.id, gasto_id)
    tarefas.add_task(backup.remover_espelho, str(gasto_id))
    return Response(status_code=status.HTTP_204_NO_CONTENT)
