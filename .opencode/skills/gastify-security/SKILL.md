---
name: GASTIFY Security
description: Seguranca do GASTIFY - JWT, Pydantic, .env e erros sem leak. Carregar para revisar autenticacao e validacao da API.
---

## Regras

1. **Credenciais:** proibido hardcodar senhas, chaves de API ou strings de conexao. Usar variaveis de ambiente (.env + python-dotenv) e fornecer .env.example.
2. **Validacao/Sanitizacao:** todo input validado com Pydantic para evitar Injecao de SQL e dados maliciosos.
3. **Autenticacao:** rotas protegidas com JWT (JSON Web Token). Apenas usuarios autorizados criam/leem/atualizam/deletam gastos.
4. **Erros sem leak:** retornar JSON amigavel (ex: "Erro interno no servidor"). Nunca stack trace nem informacao do banco.
5. **Documentacao:** comentarios em Portugues explicando o que e o porque.

## Checklist ao revisar
- Nenhum segredo no codigo ou git (.gitignore para .env).
- Rotas sem token retornam 401/403.
- Inputs invalidos retornam erro de validacao, nunca 500 com stack trace.
- Banco acessado apenas via ORM com parametros, sem SQL concatenado.
