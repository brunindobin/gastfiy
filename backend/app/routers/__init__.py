"""Routers (camada HTTP) do GASTIFY.

Cada arquivo agrupa os endpoints de um domínio e apenas orquestra:
valida (Pydantic) -> chama a camada de serviço -> devolve o schema de saída.
Nenhuma regra de negócio e nenhuma query SQL moram aqui.

    health.py     -> GET /health e GET /health/live
    auth.py       -> cadastro, login e usuário atual (JWT)
    gastos.py     -> CRUD de gastos com filtros e paginação
    agregacoes.py -> séries mensal/anual e totais por categoria (dashboard)
"""

from app.routers import agregacoes, auth, gastos, health

__all__ = ["agregacoes", "auth", "gastos", "health"]
