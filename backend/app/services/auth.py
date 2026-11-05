"""Serviço de autenticação: cadastro, login e consulta do usuário atual.

Camada responsável por regra de negócio e transação — o router apenas traduz
HTTP. Aqui ficam as decisões que não podem vazar para a camada web:

  * e-mail é comparado em minúsculas (um cadastro por pessoa);
  * senha nunca é retornada, logada ou comparada em texto;
  * falha de login usa mensagem única para e-mail inexistente e senha errada.
"""

from __future__ import annotations

import logging
import uuid

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.orm import Session

from app.core.exceptions import ErroConflito, ErroNaoAutorizado
from app.core.security import gerar_hash_senha, verificar_senha
from app.models import Usuario
from app.schemas.usuario import UsuarioCreate

logger = logging.getLogger("gastify.auth")


def registrar(db: Session, dados: UsuarioCreate) -> Usuario:
    """Cria um usuário novo com senha hasheada.

    Verificamos a duplicidade antes do INSERT para devolver 409 com mensagem
    clara. Ainda assim tratamos `IntegrityError` (violação do índice único),
    porque duas requisições simultâneas podem passar pela checagem ao mesmo
    tempo — o banco é a última linha de defesa.
    """
    existente = db.scalar(select(Usuario).where(Usuario.email == dados.email))
    if existente is not None:
        raise ErroConflito("Este e-mail já está cadastrado.", codigo="EMAIL_JA_CADASTRADO")

    usuario = Usuario(
        id=uuid.uuid4(),
        nome=dados.nome,
        email=dados.email,
        senha_hash=gerar_hash_senha(dados.senha),
    )
    db.add(usuario)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise ErroConflito("Este e-mail já está cadastrado.", codigo="EMAIL_JA_CADASTRADO") from None
    except SQLAlchemyError:
        db.rollback()
        raise

    db.refresh(usuario)
    logger.info("Novo usuário cadastrado: %s", usuario.id)
    return usuario


def autenticar(db: Session, email: str, senha: str) -> Usuario:
    """Valida credenciais e devolve o usuário.

    A mesma exceção (`CREDENCIAIS_INVALIDAS`) é usada para e-mail inexistente e
    senha errada: qualquer diferença permitiria descobrir quais e-mails existem.
    """
    usuario = db.scalar(select(Usuario).where(Usuario.email == email.strip().lower()))
    if usuario is None or not verificar_senha(senha, usuario.senha_hash):
        # Log interno sem dado pessoal; o cliente recebe mensagem genérica.
        logger.info("Tentativa de login inválida.")
        raise ErroNaoAutorizado("E-mail ou senha inválidos.", codigo="CREDENCIAIS_INVALIDAS")
    return usuario
