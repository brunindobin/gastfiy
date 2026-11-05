# GASTIFY — Backend (FastAPI + PostgreSQL + MongoDB)

API REST do **GASTIFY**, app Android de gestão financeira pessoal.

> **Status: v1 completa.** JWT, CRUD de gastos com filtros/paginação,
> agregações (mensal/anual) e Double Backup (PostgreSQL → MongoDB) implementados
> e cobertos por testes de integração.

---

## 1. Stack

| Item | Escolha | Por quê |
| :--- | :--- | :--- |
| Framework | FastAPI | Async, validação integrada e Swagger automático |
| ORM | SQLAlchemy 2.x | Tipagem estática e queries parametrizadas (sem SQL concatenado) |
| Banco principal | PostgreSQL 16 | Integridade transacional, `NUMERIC` exato para dinheiro |
| Banco secundário | MongoDB 7 | Espelho do Double Backup (documento = gasto) |
| Auth | JWT (PyJWT) + bcrypt | Rotas protegidas, senha nunca em texto |
| Config | pydantic-settings + python-dotenv | Nenhuma credencial no código |
| Testes | Pytest + TestClient | 72 testes (unitários + integração real) |

---

## 2. Estrutura

```text
backend/
├── app/
│   ├── main.py               # app, CORS, routers, ciclo de vida
│   ├── core/
│   │   ├── config.py         # Settings do .env (sem segredo hardcoded)
│   │   ├── security.py       # bcrypt, JWT, dependência de autenticação
│   │   └── exceptions.py     # exceções + handlers (JSON amigável, sem leak)
│   ├── database/
│   │   ├── base.py           # Base declarativa + convenção de nomes
│   │   ├── session.py        # engine, sessões, get_db()
│   │   └── nosql.py          # cliente MongoDB (lazy) + upsert/delete
│   ├── models/               # Usuario, Gasto, CategoriaGasto
│   ├── schemas/              # Pydantic v2 (entrada/saída)
│   ├── routers/              # health, auth, gastos, agregacoes
│   └── services/             # auth, gastos, agregacoes, backup
├── tests/                    # unitários + integração
├── scripts/                  # pg-local.ps1 / mongo-local.ps1 (sem admin)
├── requirements.txt
├── pytest.ini
├── docker-compose.yml        # PostgreSQL opcional
├── .env.example
└── README.md
```

---

## 3. Como rodar

### 3.1 Pré-requisitos

- Python **3.11+** (validado em 3.14)
- PostgreSQL **14+** (portátil, instalado ou container) — obrigatório
- MongoDB **7+** (portátil ou container) — opcional (Double Backup)

### 3.2 Dependências

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

```bash
# Linux / macOS
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
```

### 3.3 Variáveis de ambiente

```powershell
Copy-Item .env.example .env
```

Preencha **`POSTGRES_PASSWORD`** e **`SECRET_KEY`** (gere com
`python -c "import secrets; print(secrets.token_urlsafe(48))"`). A URL do
PostgreSQL é montada a partir das partes `POSTGRES_*` — não existe URL pronta.

> ⚠️ `.env` está no `.gitignore` e nunca deve ser commitado.

### 3.4 Banco principal (escolha uma opção)

**A) PostgreSQL portátil (sem instalador, sem admin)**

```powershell
# baixe o zip "binaries" em https://www.enterprisedb.com/download-postgresql-binaries
# e extraia em E:\gastify\pgsql
powershell -ExecutionPolicy Bypass -File scripts\pg-local.ps1 init    # 1ª vez
powershell -ExecutionPolicy Bypass -File scripts\pg-local.ps1 start
```

**B) Docker**

```powershell
docker compose up -d
```

**C) PostgreSQL já instalado**

```sql
CREATE DATABASE gastify;
```

### 3.5 Banco secundário (Double Backup)

```powershell
# baixe o zip em https://www.mongodb.com/try/download/community (Windows .zip)
# e extraia em E:\gastify\mongodb
powershell -ExecutionPolicy Bypass -File scripts\mongo-local.ps1 start
```

Sem MongoDB a API funciona normalmente; só o espelho não é atualizado.

### 3.6 Subir a API

```powershell
uvicorn app.main:app --reload --port 8000
```

- API: <http://127.0.0.1:8000>
- Swagger: <http://127.0.0.1:8000/docs>
- Health: <http://127.0.0.1:8000/health>

---

## 4. Endpoints (v1)

Contrato completo em [`../docs/API.md`](../docs/API.md).

### Autenticação
| Método | Rota | Descrição |
| :--- | :--- | :--- |
| POST | `/api/v1/auth/registrar` | cria conta (201) |
| POST | `/api/v1/auth/login` | devolve JWT + usuário |
| GET | `/api/v1/auth/eu` | dados do usuário autenticado |

### Gastos (Bearer obrigatório)
| Método | Rota | Descrição |
| :--- | :--- | :--- |
| POST | `/api/v1/gastos` | cria (201) |
| GET | `/api/v1/gastos` | lista com `data`, `data_inicio`, `data_fim`, `categoria` (repetível), `busca`, `limite`, `offset` |
| GET | `/api/v1/gastos/{id}` | detalhe |
| PUT | `/api/v1/gastos/{id}` | atualização parcial |
| DELETE | `/api/v1/gastos/{id}` | remove (204) |

### Agregações (Bearer obrigatório)
| Método | Rota | Descrição |
| :--- | :--- | :--- |
| GET | `/api/v1/agregacoes/resumo?data=` | total do dia + por categoria |
| GET | `/api/v1/agregacoes/mensal?ano=&mes=` | série diária + categorias |
| GET | `/api/v1/agregacoes/anual?ano=` | série mensal (12 meses) + categorias |
| GET | `/api/v1/agregacoes/categorias` | totais por categoria em um intervalo |

### Saúde
| Método | Rota | Descrição |
| :--- | :--- | :--- |
| GET | `/health` | API + PostgreSQL (200/503) |
| GET | `/health/live` | processo vivo (sem banco) |

### Formato de erro

```json
{ "erro": "Dados inválidos", "codigo": "VALIDACAO",
  "detalhes": [ { "campo": "valor", "mensagem": "Deve ser maior que 0." } ] }
```

Nunca retornamos stack trace, SQL, nome de tabela ou credenciais.

---

## 5. Modelo de dados

**`usuarios`**: `id` (UUID), `nome`, `email` (único, minúsculo), `senha_hash` (bcrypt), `criado_em`.

**`gastos`**:

| Coluna | Tipo | Regra |
| :--- | :--- | :--- |
| `id` | UUID | PK gerada na aplicação (mesmo id no Mongo) |
| `usuario_id` | UUID | FK `usuarios.id`, `ON DELETE CASCADE`, indexado |
| `nome` | varchar(120) | obrigatório, não vazio |
| `valor` | numeric(12,2) | obrigatório, `> 0` |
| `data` | date | obrigatório, indexado, não futura |
| `categoria` | enum | 7 categorias do produto |
| `criado_em` / `atualizado_em` | timestamptz | auditoria (UTC) |

---

## 6. Double Backup

1. Escrita acontece no **PostgreSQL** (fonte da verdade).
2. Depois do commit, o router enfileira uma `BackgroundTask` que faz **upsert**
   do documento no MongoDB usando o mesmo UUID (`_id`).
3. A resposta HTTP **não espera** o NoSQL (latência menor).
4. Falha no Mongo não desfaz a operação: é logada e pode ser reprocessada.
5. `DELETE` remove o documento espelho (idempotente).

---

## 7. Testes

```powershell
python -m pytest -q
```

- **72 testes**: unitários (schemas, handlers, health, modelo, config) +
  integração real (auth, CRUD, filtros, paginação, agregações, isolamento entre
  usuários e Double Backup).
- Os testes usam os bancos `gastify_teste` (PostgreSQL) e `gastify_teste`
  (MongoDB) — nunca tocam nos dados de desenvolvimento.
- Sem PostgreSQL/MongoDB disponíveis, os testes de integração são **pulados**
  automaticamente (a suíte unitária continua verde).

---

## 8. Segurança aplicada

- **Zero credencial no código:** `.env` + `python-dotenv`; `.env.example` documenta as chaves.
- **Senhas:** bcrypt com custo 12; nunca retornadas, logadas ou comparadas em texto.
- **JWT:** `SECRET_KEY` obrigatória no `.env`; token com `exp`; 401 com códigos distintos.
- **Validação:** Pydantic v2 em toda entrada (`extra="forbid"`, limites, enums).
- **SQL:** apenas ORM parametrizado.
- **Isolamento:** toda query filtra por `usuario_id`; recurso alheio responde 404.
- **Erros:** handlers globais devolvem JSON amigável; traceback só no log.
- **CORS:** `*` em dev, restringível por `.env`.

---

## 9. Problemas comuns

| Sintoma | Causa provável | Solução |
| :--- | :--- | :--- |
| `/health` responde 503 | PostgreSQL parado/senha errada | `scripts\pg-local.ps1 start` ou ajuste o `.env` |
| `SECRET_KEY` ausente | login/cadastro falham com 500 | gere e preencha no `.env` |
| Double Backup vazio | MongoDB parado | `scripts\mongo-local.ps1 start` |
| `ModuleNotFoundError: app` | rodou fora de `backend/` | execute a partir de `backend/` |
| Testes de integração pulados | bancos não configurados | suba PG/Mongo ou ignore (unitários passam) |

---

Desenvolvido por **Bruno Merullo**.
