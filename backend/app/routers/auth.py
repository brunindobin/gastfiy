"""Router de autenticação (`/api/v1/auth`).

Fluxo: cadastro -> login (token JWT) -> app envia `Authorization: Bearer ...`
em todas as chamadas seguintes. Nenhuma senha é devolvida em resposta.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.core.security import criar_token_acesso, obter_usuario_atual
from app.database.session import get_db
from app.models import Usuario
from app.schemas.usuario import LoginRequest, TokenResponse, UsuarioCreate, UsuarioRead
from app.services import auth as servico_auth

router = APIRouter(prefix="/auth", tags=["autenticação"])


@router.post(
    "/registrar",
    status_code=status.HTTP_201_CREATED,
    response_model=UsuarioRead,
    summary="Cria uma conta",
    responses={409: {"description": "E-mail já cadastrado."}},
)
def registrar(dados: UsuarioCreate, db: Session = Depends(get_db)) -> Usuario:
    """Cadastra o usuário com senha hasheada (bcrypt) e devolve os dados públicos."""
    return servico_auth.registrar(db, dados)


@router.post(
    "/login",
    response_model=TokenResponse,
    summary="Autentica e devolve o token JWT",
    responses={401: {"description": "E-mail ou senha inválidos."}},
)
def login(dados: LoginRequest, db: Session = Depends(get_db)) -> TokenResponse:
    """Valida as credenciais e emite o access token.

    A resposta já inclui os dados do usuário para o app montar a home sem uma
    chamada extra (menos latência no primeiro acesso).
    """
    usuario = servico_auth.autenticar(db, dados.email, dados.senha)
    token, minutos = criar_token_acesso(usuario.id)
    return TokenResponse(
        access_token=token,
        expira_em_minutos=minutos,
        usuario=UsuarioRead.model_validate(usuario),
    )


@router.get(
    "/eu",
    response_model=UsuarioRead,
    summary="Dados do usuário autenticado",
    responses={401: {"description": "Token ausente ou inválido."}},
)
def eu(usuario: Usuario = Depends(obter_usuario_atual)) -> Usuario:
    """Usado pelo app ao abrir para validar se a sessão salva ainda vale."""
    return usuario
