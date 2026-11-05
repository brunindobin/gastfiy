# GASTIFY 💸

App de **gestão financeira pessoal** para Android, com backend próprio.

> **v1 completa:** autenticação JWT, CRUD de gastos, filtros por categoria/data,
> dashboard com agregações mensal/anual, modo **escuro e claro** e
> **Double Backup** (PostgreSQL → MongoDB).

---

## O que tem aqui

| Pasta | Conteúdo |
| :--- | :--- |
| [`backend/`](./backend) | API FastAPI (PostgreSQL + MongoDB), testes Pytest |
| [`mobile/`](./mobile) | App Android em Expo + React Native + TypeScript |
| [`docs/API.md`](./docs/API.md) | Contrato da API consumido pelo app |
| [`docs/design/`](./docs/design) | Design system "Obsidian Lumina" (tokens + telas) |

---

## Funcionalidades

- **Início**: boas-vindas dinâmica (data/hora), gastos **apenas do dia**, seletor de dias anteriores.
- **Novo gasto**: nome, valor, data e categoria (7 categorias).
- **Filtros**: busca por texto, intervalo de datas e multi-seleção de categorias.
- **Dashboard**: totais mensal/anual, gráfico por dia/mês e por categoria.
- **Tema**: escuro, claro ou automático (persistido).
- **Rodapé**: "Desenvolvido por Bruno Merullo" em todas as telas.
- **Segurança**: senha com bcrypt, rotas protegidas por JWT, isolamento de dados por usuário, erros sem vazamento.
- **Double Backup**: cada escrita é espelhada no MongoDB em background.

---

## Rodar localmente (resumo)

### Backend

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item .env.example .env     # preencha POSTGRES_PASSWORD e SECRET_KEY

# bancos (portáteis, sem admin)
powershell -ExecutionPolicy Bypass -File scripts\pg-local.ps1 start
powershell -ExecutionPolicy Bypass -File scripts\mongo-local.ps1 start

uvicorn app.main:app --reload --port 8000
```

Detalhes: [`backend/README.md`](./backend/README.md) · API: <http://127.0.0.1:8000/docs>

### App

```powershell
cd mobile
npm install
npm start           # abra no Expo Go ou emulador Android
```

Detalhes: [`mobile/README.md`](./mobile/README.md)

---

## Testes

```powershell
cd backend
python -m pytest -q          # API (unitários + integração)
```

```powershell
cd mobile
npm test                     # componentes, telas e utilitários
```

---

## Arquitetura

```text
App Android (Expo/React Native)
        │  HTTPS + JWT
        ▼
FastAPI  ──►  PostgreSQL (fonte da verdade)
   │
   └──────►  MongoDB (Double Backup, BackgroundTasks)
```

---

Desenvolvido por **Bruno Merullo**.
