"""Schemas Pydantic de usuário e autenticação.

Regras de segurança embutidas aqui:
  * `senha` tem limite máximo de 72 bytes porque o bcrypt ignora o que passa
    disso — aceitar mais daria a falsa sensação de uma senha mais forte.
  * No login NÃO repetimos as regras de força da senha: a mensagem de erro é
    sempre genérica, então não revelamos a política para quem está tentando
    adivinhar credenciais.
  * `extra="forbid"` bloqueia campos como `id`/`senha_hash` vindos do cliente.
"""

from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator


class UsuarioCreate(BaseModel):
    """Payload de `POST /api/v1/auth/registrar`."""

    model_config = ConfigDict(extra="forbid")

    nome: str = Field(min_length=1, max_length=120, description="Nome exibido no app.")
    email: EmailStr = Field(description="E-mail de acesso (único).")
    senha: str = Field(min_length=8, max_length=72, description="Senha com 8 a 72 caracteres.")

    @field_validator("nome")
    @classmethod
    def normalizar_nome(cls, valor: str) -> str:
        """Remove espaços das pontas e recusa nome vazio."""
        limpo = valor.strip()
        if not limpo:
            raise ValueError("O nome não pode ser vazio.")
        return limpo

    @field_validator("email")
    @classmethod
    def normalizar_email(cls, valor: str) -> str:
        """Padroniza em minúsculas para evitar cadastro duplicado.

        Ex.: "Bruno@Exemplo.com" e "bruno@exemplo.com" precisam ser o MESMO
        usuário — por isso a normalização acontece antes de qualquer consulta.
        """
        return valor.strip().lower()


class LoginRequest(BaseModel):
    """Payload de `POST /api/v1/auth/login` (JSON, não formulário)."""

    model_config = ConfigDict(extra="forbid")

    email: EmailStr
    senha: str = Field(min_length=1, max_length=72)

    @field_validator("email")
    @classmethod
    def normalizar_email(cls, valor: str) -> str:
        """Mesma normalização do cadastro (comparação case-insensitive)."""
        return valor.strip().lower()


class UsuarioRead(BaseModel):
    """Representação pública do usuário (nunca inclui hash de senha)."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    nome: str
    email: EmailStr
    criado_em: datetime


class TokenResponse(BaseModel):
    """Resposta do login: token + dados mínimos para a home."""

    access_token: str = Field(description="JWT a ser enviado no header Authorization.")
    token_type: str = Field(default="bearer")
    expira_em_minutos: int = Field(description="Validade do token em minutos.")
    usuario: UsuarioRead
