---
name: GASTIFY Backend
description: Padroes do backend FastAPI do GASTIFY - Double Backup, CRUD de gastos e agregacoes. Carregar ao implementar a API.
---

## Stack
- Python + FastAPI, PostgreSQL (principal) + NoSQL (MongoDB/Firebase, espelho), SQLAlchemy ou SQLModel, Pydantic, JWT.

## Estrutura (Arquitetura Limpa)
```
backend/
  app/
    models/      # SQLAlchemy/SQLModel
    routers/     # endpoints CRUD + agregacoes
    database/    # sessao PostgreSQL, cliente NoSQL
    services/    # regras de negocio + Double Backup
    core/        # configuracao .env, seguranca JWT
  tests/
  .env.example
```

## Modelo Gasto
- Nome (string), Valor (numero), Data (date/datetime), Categoria (ex: Gastos Obrigatorios, Lazer).

## Double Backup
- A cada escrita (POST, PUT, DELETE) no PostgreSQL, enfileirar espelhamento no NoSQL via `BackgroundTasks` do FastAPI (assincrono, nao bloquear resposta).
- Manter id de correlacao igual nos dois bancos.

## Endpoints
- CRUD completo de gastos + GET principal estruturado para Postman.
- Agregacoes: total mensal e anual por categoria para graficos.

## Regras
- Comentarios em Portugues (o que + porque). Sem hardcode de credenciais. Erros amigaveis.
