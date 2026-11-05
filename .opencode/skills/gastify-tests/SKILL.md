---
name: GASTIFY Tests
description: Testes automatizados do GASTIFY com Pytest - validacao de endpoints, Double Backup e filtros. Carregar ao escrever ou rodar testes.
---

## Escopo
- Backend: Pytest para endpoints CRUD, JWT, Pydantic e erros sem leak.
- Double Backup: assert que o dado no PostgreSQL reflete no NoSQL apos escrita.
- Agregacoes: mensal/anual conferem com os gastos criados.
- Frontend (quando houver API): filtros por categoria e paginacao/navegacao por data.

## Padroes
- Fixtures para banco de teste (PostgreSQL efemero) e cliente de teste FastAPI.
- Comentar cada teste em Portugues explicando o que e o porque.
- Nunca usar credenciais reais: .env de teste.

## Como rodar
```bash
pytest -q
```

## Relatorio
Sempre retornar pass/fail por caso, tempo de execucao e, em falha, como reproduzir.
