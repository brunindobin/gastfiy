# GASTIFY — Contrato da API (v1)

> Fonte da verdade para o app Android. Base: `http://<host>:8000`
> Autenticação: `Authorization: Bearer <token>` em todas as rotas de domínio.
> Formato de erro padrão: `{ "erro": "...", "codigo": "...", "detalhes": [...] }`

## Convenções

- Valores monetários em **número JSON** com 2 casas (`19.9`).
- Datas em **`AAAA-MM-DD`** (sem hora). Timestamps em **ISO 8601 UTC**.
- Categorias (slug → rótulo):
  `gastos_obrigatorios` → "Gastos Obrigatórios" · `lazer` → "Lazer" ·
  `alimentacao` → "Alimentação" · `transporte` → "Transporte" ·
  `saude` → "Saúde" · `educacao` → "Educação" · `outros` → "Outros"
- Paginação: `limite` (1–200, padrão 50) e `offset` (≥ 0, padrão 0).
- Ordenação da listagem: `data` desc, depois `criado_em` desc.

---

## 1. Saúde

| Método | Rota | Auth | Resposta |
| :--- | :--- | :--- | :--- |
| GET | `/health` | não | `200 {"status":"ok","database":"connected",...}` ou `503` |
| GET | `/health/live` | não | `200 {"status":"ok"}` |

---

## 2. Autenticação

### POST `/api/v1/auth/registrar`
```json
{ "nome": "Bruno Merullo", "email": "bruno@exemplo.com", "senha": "minimo8chars" }
```
`201` → `{ "id": "uuid", "nome": "...", "email": "...", "criado_em": "..." }`
Erros: `409 EMAIL_JA_CADASTRADO`, `422 VALIDACAO`.

### POST `/api/v1/auth/login`
```json
{ "email": "bruno@exemplo.com", "senha": "minimo8chars" }
```
`200` →
```json
{
  "access_token": "eyJ...",
  "token_type": "bearer",
  "expira_em_minutos": 60,
  "usuario": { "id": "uuid", "nome": "...", "email": "..." }
}
```
Erros: `401 CREDENCIAIS_INVALIDAS` (mesma mensagem para e-mail inexistente e senha errada).

### GET `/api/v1/auth/eu`
`200` → `{ "id": "uuid", "nome": "...", "email": "...", "criado_em": "..." }`

---

## 3. Gastos (todos exigem Bearer)

### POST `/api/v1/gastos`
```json
{ "nome": "Aluguel", "valor": 1500.0, "data": "2026-11-04", "categoria": "gastos_obrigatorios" }
```
`201` → **GastoRead**. Erros: `401`, `422` (valor ≤ 0, data futura, categoria inválida, nome vazio).

**GastoRead**
```json
{
  "id": "uuid",
  "nome": "Aluguel",
  "valor": 1500.0,
  "data": "2026-11-04",
  "categoria": "gastos_obrigatorios",
  "categoria_rotulo": "Gastos Obrigatórios",
  "criado_em": "2026-11-04T23:10:00Z",
  "atualizado_em": "2026-11-04T23:10:00Z"
}
```

### GET `/api/v1/gastos`
Query params (todos opcionais):

| Param | Tipo | Efeito |
| :--- | :--- | :--- |
| `data` | `AAAA-MM-DD` | gastos **do dia** (home) |
| `data_inicio` | `AAAA-MM-DD` | início do intervalo (inclusive) |
| `data_fim` | `AAAA-MM-DD` | fim do intervalo (inclusive) |
| `categoria` | slug | filtra por categoria (aceita repetição) |
| `busca` | texto | trecho do nome (case-insensitive) |
| `limite` | int | 1–200 (padrão 50) |
| `offset` | int | ≥ 0 (padrão 0) |

`200` → `{ "total": 42, "itens": [ GastoRead, ... ] }`
Erros: `401`, `422` (data inválida / `data_inicio` > `data_fim`).

### GET `/api/v1/gastos/{id}`
`200` → **GastoRead** · `404 GASTO_NAO_ENCONTRADO` (também para gasto de outro usuário).

### PUT `/api/v1/gastos/{id}`
Corpo parcial (qualquer subconjunto de `nome`, `valor`, `data`, `categoria`).
`200` → **GastoRead** · `404`, `422` (corpo vazio).

### DELETE `/api/v1/gastos/{id}`
`204` (sem corpo) · `404`.

---

## 4. Agregações (dashboard)

### GET `/api/v1/agregacoes/resumo?data=AAAA-MM-DD`
```json
{
  "data": "2026-11-04",
  "total": 123.5,
  "quantidade": 3,
  "por_categoria": [
    { "categoria": "lazer", "rotulo": "Lazer", "total": 80.0, "quantidade": 2 }
  ]
}
```

### GET `/api/v1/agregacoes/mensal?ano=2026&mes=11`
```json
{
  "ano": 2026, "mes": 11, "total": 1500.0, "quantidade": 12,
  "por_categoria": [ { "categoria": "lazer", "rotulo": "Lazer", "total": 200.0, "quantidade": 4 } ],
  "por_dia": [ { "dia": "2026-11-01", "total": 45.9, "quantidade": 1 } ]
}
```

### GET `/api/v1/agregacoes/anual?ano=2026`
```json
{
  "ano": 2026, "total": 18000.0, "quantidade": 150,
  "por_mes": [ { "mes": 1, "total": 1500.0, "quantidade": 12 } ],
  "por_categoria": [ { "categoria": "saude", "rotulo": "Saúde", "total": 900.0, "quantidade": 3 } ]
}
```

### GET `/api/v1/agregacoes/categorias?data_inicio=...&data_fim=...`
`200` → `{ "total": 1234.5, "por_categoria": [ ... ] }`
(`data_inicio`/`data_fim` opcionais; sem filtro = todo o histórico do usuário.)

Erros: `401`, `422` (mês/ano fora da faixa, intervalo invertido).

---

## 5. Códigos de erro

| HTTP | Código | Quando |
| :--- | :--- | :--- |
| 401 | `NAO_AUTORIZADO` / `TOKEN_INVALIDO` | sem token, token expirado ou inválido |
| 401 | `CREDENCIAIS_INVALIDAS` | login incorreto |
| 403 | `ACESSO_NEGADO` | token válido sem permissão |
| 404 | `NAO_ENCONTRADO` / `GASTO_NAO_ENCONTRADO` | recurso inexistente |
| 409 | `EMAIL_JA_CADASTRADO` | e-mail duplicado |
| 422 | `VALIDACAO` / `REGRA_NEGOCIO` | payload inválido |
| 429 | ~~`MUITAS_REQUISICOES`~~ | *não implementado na v1* |
| 500 | `ERRO_INTERNO` | falha inesperada (sem detalhe técnico) |
| 503 | `BANCO_INDISPONIVEL` | PostgreSQL/NoSQL fora |

---

## 6. Exemplo rápido (cURL)

```bash
# registrar
curl -X POST http://127.0.0.1:8000/api/v1/auth/registrar \
  -H "Content-Type: application/json" \
  -d '{"nome":"Bruno","email":"bruno@exemplo.com","senha":"senha123"}'

# login
TOKEN=$(curl -s -X POST http://127.0.0.1:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"bruno@exemplo.com","senha":"senha123"}' | jq -r .access_token)

# gastos do dia
curl -H "Authorization: Bearer $TOKEN" \
  "http://127.0.0.1:8000/api/v1/gastos?data=$(date +%F)"
```
