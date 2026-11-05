"""Modelos ORM do GASTIFY (SQLAlchemy 2.x).

Reexporta `Gasto`, `CategoriaGasto` e `Usuario` para que o restante do código
possa fazer `from app.models import Gasto` sem conhecer o arquivo interno.
Também garante que importar o pacote registre TODOS os modelos no
`Base.metadata` — necessário para criar tabelas e para o Alembic no futuro.
"""

from app.models.gasto import CategoriaGasto, Gasto
from app.models.usuario import Usuario

__all__ = ["CategoriaGasto", "Gasto", "Usuario"]
