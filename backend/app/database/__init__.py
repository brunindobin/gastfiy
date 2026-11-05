"""Camada de banco de dados: sessão PostgreSQL (principal) e NoSQL (espelho).

Arquivos:
    base.py    -> Base declarativa do SQLAlchemy 2.x + convenção de nomes.
    session.py -> engine, fábrica de sessões e dependência `get_db()`.
    nosql.py   -> placeholder do Double Backup (Fase 4).
"""
