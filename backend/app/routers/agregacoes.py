"""Router de agregações (`/api/v1/agregacoes`) — alimenta os gráficos do app.

Todas as rotas exigem JWT e calculam as somas no banco (ver
`app/services/agregacoes.py`). O app só renderiza o que recebe.
"""

from __future__ import annotations

from datetime import date

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.exceptions import ErroValidacaoNegocio
from app.core.security import obter_usuario_atual
from app.database.session import get_db
from app.models import Usuario
from app.services import agregacoes as servico

router = APIRouter(prefix="/agregacoes", tags=["agregações"])


@router.get("/resumo", summary="Total do dia + por categoria (home)")
def resumo_do_dia(
    data: date | None = Query(default=None, description="Dia desejado (padrão: hoje)."),
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(obter_usuario_atual),
) -> dict:
    """Sem `data`, usa o dia atual do servidor (mesma regra da home)."""
    return servico.resumo_dia(db, usuario.id, data or date.today())


@router.get("/mensal", summary="Série do mês (por dia e por categoria)")
def mensal(
    ano: int = Query(ge=2000, le=2100, description="Ano (ex.: 2026)."),
    mes: int = Query(ge=1, le=12, description="Mês (1-12)."),
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(obter_usuario_atual),
) -> dict:
    """Usado pelo gráfico de barras do dashboard (dias zerados inclusos)."""
    return servico.mensal(db, usuario.id, ano, mes)


@router.get("/anual", summary="Série do ano (por mês e por categoria)")
def anual(
    ano: int = Query(ge=2000, le=2100, description="Ano (ex.: 2026)."),
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(obter_usuario_atual),
) -> dict:
    """Usado na visão anual (meses zerados inclusos)."""
    return servico.anual(db, usuario.id, ano)


@router.get("/categorias", summary="Totais por categoria em um intervalo")
def categorias(
    data_inicio: date | None = Query(default=None, description="Início do intervalo."),
    data_fim: date | None = Query(default=None, description="Fim do intervalo."),
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(obter_usuario_atual),
) -> dict:
    """Sem intervalo, considera todo o histórico do usuário."""
    if data_inicio and data_fim and data_inicio > data_fim:
        raise ErroValidacaoNegocio(
            "A data inicial não pode ser posterior à data final.",
            codigo="INTERVALO_INVALIDO",
        )
    return servico.por_categoria(db, usuario.id, data_inicio, data_fim)
