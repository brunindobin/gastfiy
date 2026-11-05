"""Modelo ORM `Usuario` — dono dos gastos e base da autenticação JWT.

Por que existe:
  * Toda rota de gastos é protegida por JWT, então precisamos de uma identidade
    persistida para validar credenciais e amarrar cada gasto a um dono.
  * Com `usuario_id` em `gastos`, um usuário jamais enxerga (ou altera) dados de
    outro — o filtro por dono é aplicado em TODAS as queries de serviço.

Decisões:
  * `email` é guardado em minúsculas e tem índice único: evita duplicidade
    ("Bruno@x.com" vs "bruno@x.com") e acelera o login.
  * `senha_hash` guarda apenas o hash bcrypt — a senha em texto nunca toca o
    banco nem os logs.
  * O `id` é UUID, igual ao gasto, para não expor volume de cadastros.
"""

from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import DateTime, String, Uuid, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database.base import Base


class Usuario(Base):
    """Usuário do GASTIFY (dono dos gastos)."""

    __tablename__ = "usuarios"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        comment="Identificador único do usuário.",
    )

    nome: Mapped[str] = mapped_column(
        String(120),
        nullable=False,
        comment="Nome exibido na saudação da home.",
    )

    email: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        unique=True,   # garante um cadastro por e-mail também no banco
        index=True,    # login consulta por e-mail
        comment="E-mail de acesso, sempre em minúsculas.",
    )

    senha_hash: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        comment="Hash bcrypt da senha. Nunca guardamos a senha em texto.",
    )

    criado_em: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        comment="Instante de criação (UTC).",
    )

    def __repr__(self) -> str:
        """Representação segura para logs: sem e-mail nem hash."""
        return f"<Usuario id={self.id}>"
