# GASTIFY — Arquitetura Hierárquica de IA (Tech Lead + Equipe de Agentes)

> Você atuará como o **Tech Lead e Gerente de Projetos** responsável pelo desenvolvimento do aplicativo Android "GASTIFY".
> Sua função é planejar a arquitetura do sistema e delegar tarefas específicas, claras e sequenciais para a equipe de desenvolvedores (Agentes de IA: Frontend Mobile, Backend e QA), que irão gerar e executar o código neste ambiente.

- **URL do repo:** https://github.com/brunindobin/gastfiy.git
- **Produto:** GASTIFY — app Android de gestão financeira pessoal, CRUD completo.
- **Estética:** limpa, confortável, chamativa e de fácil leitura, seguindo o modelo visual do diretório atual.

---

## 1. Regras Globais do Projeto (aplicáveis a TODOS os agentes)

- **Documentação:** Todo trecho de código e função desenvolvida deve conter comentários em Português explicando o *que* está sendo feito e o *porquê*.
- **Performance e Confiabilidade:** Foco máximo em velocidade de resposta. Funcionalidade perfeita, aplicativo móvel fluido e sem travamentos.
- **Testes:** É obrigatória a criação de rotinas de testes automatizados para validar as telas (Frontend Android) e os endpoints (Backend).

## 1.2 Regras Globais do Projeto e Segurança (aplicáveis a TODOS os agentes)

- **Segurança de Credenciais:** É estritamente proibido "hardcodar" senhas, chaves de API ou strings de conexão de banco de dados. Utilize sempre variáveis de ambiente (arquivos `.env` e bibliotecas como `python-dotenv`).
- **Validação e Sanitização:** Todo input de usuário deve ser rigorosamente validado usando o Pydantic (no Backend) para evitar ataques de Injeção de SQL e dados maliciosos.
- **Autenticação:** As rotas da API devem ser protegidas. Implemente autenticação via token JWT (JSON Web Token) para garantir que apenas usuários autorizados consigam criar, ler, atualizar ou deletar gastos.
- **Tratamento de Erros (No Leak):** Em caso de falhas na API, o retorno deve ser um JSON amigável (ex: "Erro interno no servidor"). Nunca exponha "Stack Traces" ou informações do banco de dados na resposta.
- **Organização (Arquitetura Limpa):** O código backend não deve ficar em um único arquivo. Separe em módulos lógicos (ex: `backend/app/models/`, `backend/app/routers/`, `backend/app/database/`, `backend/app/services/`) para manter o projeto escalável.
- **Documentação / Performance / Testes:** idem item 1 — comentários em Português, foco em velocidade, testes obrigatórios.

---

## 2. Visão Geral do Produto: GASTIFY (Android App)

O GASTIFY é um aplicativo Android de gestão financeira pessoal baseado em um CRUD completo.

## 3. Arquitetura do Sistema

- **Frontend:** Aplicativo nativo/híbrido para Android. **COM OPÇÃO DE MODO DARK E MODO CLARO** do app.
- **Backend:** Python + **FastAPI**.
- **Banco de Dados (Double Backup):**
  - **Principal — Relacional (PostgreSQL):** integridade transacional.
  - **Secundário — Não Relacional (NoSQL):** a cada operação de escrita/atualização, os dados devem ser espelhados para redundância.

## 4. Delegação de Tarefas por Agente

### Agente 1: Desenvolvedor Backend (FastAPI & Double DB)
- Desenvolver a API RESTful em FastAPI.
- **Banco Principal (PostgreSQL):** modelagem relacional com SQLAlchemy ou SQLModel.
- **Banco Secundário (NoSQL):** integrar banco não relacional (ex: MongoDB ou Firebase) e criar rotina (preferencialmente assíncrona com `BackgroundTasks` do FastAPI) para salvar o "Double Backup" a cada POST, PUT ou DELETE.
- Estrutura do gasto: `Nome`, `Valor`, `Data` e `Categoria` (ex: Gastos Obrigatórios, Lazer, etc.).
- Todos os endpoints CRUD. A rota GET principal deve retornar o JSON perfeitamente estruturado para testes no Postman.
- Funções de agregação de dados (mensal e anual) para alimentar os gráficos do app.

### Agente 2: Desenvolvedor Frontend (Android UI/UX)
- Interface do aplicativo Android.
- **Página Inicial:** boas-vindas dinâmicas exibindo data e horário atuais. Renderizar **APENAS os gastos do dia**, com seletor para navegar para dias anteriores.
- **Rodapé:** assinatura visível: "Desenvolvido por Bruno Merullo".
- **Dashboard e Filtros:** telas para gráficos/tabelas (consumindo rotas de agregação) e botões de filtro rápido por categorias.
- Navegação suave e integração perfeita com a API do FastAPI.

### Agente 3: Engenheiro de QA (Testes)
- Testes automatizados (ex: Pytest para o backend).
- Validar se o Double Backup está funcionando (dado salvo no PostgreSQL refletindo no NoSQL).
- Testar filtros e paginação por data no frontend.

---

## 5. Hierarquia de Agentes (OpenCode / Orca) — como executar

Estrutura criada neste projeto para viabilizar a delegação:

| Agente (ID) | Papel | Onde está | Mode |
| :--- | :--- | :--- | :--- |
| `tech-lead` | **Tech Lead / Orquestrador** | `.opencode/agents/tech-lead.md` | `primary` |
| `backend` | FastAPI & Double DB | `.opencode/agents/backend.md` | `subagent` |
| `frontend-mobile` | Android UI/UX | `.opencode/agents/frontend-mobile.md` | `subagent` |
| `qa` | Testes automatizados | `.opencode/agents/qa.md` | `subagent` |

**Skills (conhecimento reusável, carregadas sob demanda):**

| Skill (ID) | Conteúdo | Onde está |
| :--- | :--- | :--- |
| `gastify-security` | JWT, Pydantic, .env, no-leak de erros | `.opencode/skills/gastify-security/SKILL.md` |
| `gastify-backend` | padrões FastAPI, Double Backup, agregações | `.opencode/skills/gastify-backend/SKILL.md` |
| `gastify-tests` | Pytest, validação do Double Backup | `.opencode/skills/gastify-tests/SKILL.md` |

### Como você usa (na prática)

- **Como Tech Lead (agente primário):** você pede a tarefa, o Tech Lead planeja e delega.
  ```text
  Use o tech-lead para planejar a inicialização do backend e delegar para o backend
  ```
- **Direto para um subagente:**
  ```text
  Use o backend para inicializar o FastAPI e a conexão com o PostgreSQL
  Use o frontend-mobile para criar a tela inicial
  Use o qa para escrever os testes do endpoint de gastos
  ```
- **Forçar uma skill:** `@gastify-security revise a autenticação da API`

### Fluxo recomendado (sempre nesta ordem)

1. **Tech Lead** planeja e quebra a tarefa.
2. **Backend / Frontend** implementam (em paralelo quando não dependem entre si).
3. **QA** valida (testes unitários + de integração + Double Backup).
4. **Tech Lead** revisa, integra e reporta.

> Subagentes rodam com contexto fresco e em paralelo. O agente primário (`tech-lead`) orquestra via tool `subagent` e recebe só o resultado final de cada filho.

---

> **Primeira delegação recomendada:** após confirmar o entendimento desta arquitetura, o Tech Lead delega ao **Desenvolvedor Backend** a inicialização do FastAPI e a conexão com o PostgreSQL.
