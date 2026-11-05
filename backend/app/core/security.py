"""Segurança: hash de senha (bcrypt), emissão/validação de JWT e dependência de
autenticação usada por todas as rotas de domínio.

Princípios aplicados (AGENTS.md, seção 1.2):
  * A senha nunca é guardada em texto: só o hash bcrypt (custo 12).
  * O segredo do JWT vem do `.env`; se estiver vazio, a API falha de forma
    explícita (sem gerar token com chave previsível).
  * Mensagens de erro são genéricas: não revelamos se o problema foi e-mail,
    senha, token expirado ou usuário inexistente.
  * Comparação de senha usa a função do bcrypt (tempo constante), o que reduz a
    eficácia de ataques de temporização.
"""

from __future__ import annotations

import logging
import uuid
from datetime import datetime, timedelta, timezone

import bcrypt
import jwt
from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.exceptions import ErroConfiguracao, ErroNaoAutorizado
from app.database.session import get_db
from app.models import Usuario

logger = logging.getLogger("gastify.seguranca")

# `auto_error=False` deixa o 401 sob nosso controle: assim a resposta segue o
# JSON padrão do projeto ({erro, codigo}) em vez do formato do Starlette.
esquema_bearer = HTTPBearer(
    auto_error=False,
    description="Informe o token recebido no login: 'Bearer <token>'.",
)

# Custo do bcrypt. 12 é o equilíbrio atual entre resistência a força bruta e
# latência aceitável (~250 ms por login em máquinas comuns).
CUSTO_BCRYPT = 12


# ---------------------------------------------------------------------------
# Senhas
# ---------------------------------------------------------------------------
def gerar_hash_senha(senha: str) -> str:
    """Gera o hash bcrypt (com salt aleatório) da senha em texto.

    O salt é embutido no próprio hash, então não precisamos guardá-lo à parte.
    """
    return bcrypt.hashpw(senha.encode("utf-8"), bcrypt.gensalt(rounds=CUSTO_BCRYPT)).decode("utf-8")


def verificar_senha(senha: str, senha_hash: str) -> bool:
    """Confere a senha contra o hash guardado.

    Retorna False (em vez de explodir) para hash malformado — o login responde
    com a mesma mensagem genérica de credenciais inválidas.
    """
    try:
        return bcrypt.checkpw(senha.encode("utf-8"), senha_hash.encode("utf-8"))
    except (ValueError, TypeError):
        return False


# ---------------------------------------------------------------------------
# JWT
# ---------------------------------------------------------------------------
def _chave_secreta() -> str:
    """Lê o segredo do `.env` e impede o uso de chave vazia.

    Sem essa checagem, `jwt.encode` aceitaria string vazia e qualquer pessoa
    poderia forjar tokens válidos — falha crítica silenciosa.
    """
    chave = get_settings().SECRET_KEY
    if not chave:
        logger.error("SECRET_KEY ausente no .env: não é possível assinar tokens.")
        raise ErroConfiguracao("Configuração de autenticação incompleta.")
    return chave


def criar_token_acesso(usuario_id: uuid.UUID) -> tuple[str, int]:
    """Cria o access token JWT do usuário.

    Retorna `(token, minutos_de_validade)` — o app usa o segundo valor para
    saber quando precisa refazer o login.

    Claims usadas:
      * `sub`: id do usuário (sempre string, como exige a RFC 7519);
      * `iat`/`exp`: emissão e expiração (UTC, evitando ambiguidade de fuso);
      * `tipo`: distingue access token de futuros tokens de refresh.
    """
    config = get_settings()
    agora = datetime.now(timezone.utc)
    expira = agora + timedelta(minutes=config.ACCESS_TOKEN_EXPIRE_MINUTES)

    payload = {
        "sub": str(usuario_id),
        "iat": agora,
        "exp": expira,
        "tipo": "acesso",
    }
    token = jwt.encode(payload, _chave_secreta(), algorithm=config.JWT_ALGORITHM)
    return token, config.ACCESS_TOKEN_EXPIRE_MINUTES


def decodificar_token(token: str) -> dict:
    """Valida assinatura/expiração e devolve as claims do token.

    Levanta `ErroNaoAutorizado` (401) com códigos distintos para o app poder
    decidir entre "renovar sessão" e "fazer login de novo" — mas sem expor
    detalhe técnico da biblioteca.
    """
    config = get_settings()
    try:
        return jwt.decode(token, _chave_secreta(), algorithms=[config.JWT_ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise ErroNaoAutorizado(
            "Sua sessão expirou. Faça login novamente.",
            codigo="TOKEN_EXPIRADO",
        ) from None
    except jwt.InvalidTokenError:
        raise ErroNaoAutorizado(
            "Sessão inválida. Faça login novamente.",
            codigo="TOKEN_INVALIDO",
        ) from None


# ---------------------------------------------------------------------------
# Dependência de autenticação
# ---------------------------------------------------------------------------
def obter_usuario_atual(
    credenciais: HTTPAuthorizationCredentials | None = Depends(esquema_bearer),
    db: Session = Depends(get_db),
) -> Usuario:
    """Resolve o usuário autenticado a partir do header `Authorization`.

    Usada como dependência em todas as rotas de gastos/agregações:
        usuario: Usuario = Depends(obter_usuario_atual)

    Além de validar o token, confirma que o usuário ainda existe no banco (um
    token válido de conta removida precisa ser recusado).
    """
    if credenciais is None or not credenciais.credentials:
        raise ErroNaoAutorizado(
            "Autenticação necessária. Faça login para continuar.",
            codigo="NAO_AUTORIZADO",
        )

    payload = decodificar_token(credenciais.credentials)
    try:
        usuario_id = uuid.UUID(str(payload.get("sub", "")))
    except ValueError:
        raise ErroNaoAutorizado("Sessão inválida. Faça login novamente.", codigo="TOKEN_INVALIDO") from None

    usuario = db.get(Usuario, usuario_id)
    if usuario is None:
        raise ErroNaoAutorizado("Sessão inválida. Faça login novamente.", codigo="TOKEN_INVALIDO")
    return usuario
