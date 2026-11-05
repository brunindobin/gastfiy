"""Schemas Pydantic v2 do GASTIFY.

Camada de validação/sanitização de TODA entrada da API (regra de segurança:
nenhum dado do usuário chega ao ORM sem passar por aqui). Também definem o
contrato de saída documentado no Swagger/Postman.

Nada de SQL cru: a persistência é sempre via ORM com parâmetros.
"""

from app.schemas.gasto import GastoCreate, GastoRead, GastoUpdate
from app.schemas.usuario import LoginRequest, TokenResponse, UsuarioCreate, UsuarioRead

__all__ = [
    "GastoCreate",
    "GastoRead",
    "GastoUpdate",
    "LoginRequest",
    "TokenResponse",
    "UsuarioCreate",
    "UsuarioRead",
]
