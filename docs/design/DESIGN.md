# GASTIFY — Especificação Técnica Frontend (Para Agentes Orca)

> Este documento serve como diretriz direta para agentes de IA implementarem o frontend mobile do Gastify (React Native / Expo + NativeWind ou Next.js Mobile-First + Tailwind CSS).
>
> **Fonte da verdade de design:** este arquivo (`docs/design/DESIGN.md`) + `docs/design/tokens.json`
> **Skill para agentes:** `.opencode/skills/gastify-design/SKILL.md`
> **Referência visual (opcional):** `docs/design/screens/` — PNG exportado do Figma, 1 por tela (light/dark)

## 1. Visão Geral do Produto

- **Nome da Aplicação:** Gastify
- **Proposta:** Gestão e controle financeiro diário com foco em simplicidade, clareza e alta velocidade de lançamento.
- **Público:** Usuários que buscam controle de despesas sem complexidade excessiva de planilhas.
- **Tipografia Padrão:** Plus Jakarta Sans, sans-serif.

### Regras de produto (obrigatórias — ver AGENTS.md)

- **Página Inicial:** boas-vindas dinâmicas exibindo data e horário atuais. Renderizar **APENAS os gastos do dia**, com seletor para navegar para dias anteriores.
- **Rodapé:** assinatura visível: "Desenvolvido por Bruno Merullo".
- **Dashboard e Filtros:** telas para gráficos/tabelas (consumindo rotas de agregação mensal/anual) e botões de filtro rápido por categoria.
- **Modo:** **COM OPÇÃO DE MODO DARK E MODO CLARO** do app.
- **Performance:** foco máximo em velocidade de resposta. Funcionalidade perfeita, aplicativo móvel fluido e sem travamentos.
- **Estrutura do gasto:** `Nome`, `Valor`, `Data` e `Categoria` (ex: Gastos Obrigatórios, Lazer, etc.).

## 2. Tokens de Design & Paleta de Cores

### 2.1 Dark Mode (Tema Principal: Obsidian Lumina)

| Token | Hex | Uso |
| :--- | :--- | :--- |
| Fundo Principal (Canvas/Background) | `#0A0E18` | Background da tela |
| Superfície / Containers (Cards & Modais) | `#0F131D` | Cards, modais, containers |
| Superfície Elevada / Inputs | `#171B26` / `#1E293B` | Inputs, superfícies elevadas |
| Bordas Sutis | `#1E293B` / `#334155` | Borders, divisores |
| Destaque Primário (Neon/Cyan) | `#00D2FF` | Links, CTA primário, destaques |
| Acento Secundário (Deep Indigo/Violet) | `#6366F1` | Acento, gráficos, estados ativos |
| Gradiente de Destaque | `linear-gradient(135deg, #00D2FF 0%, #6366F1 100%)` | Botões primários, headers de destaque |
| Texto Principal | `#F8FAFC` | Títulos, valores principais |
| Texto Secundário / Labels | `#94A3B8` | Labels, placeholders, rodapé secundário |

Arquivos máquina: `docs/design/tokens.json` (campo `dark`).

### 2.2 Light Mode

> **Pendente de especificação.** Não inventar cores para o modo claro — usar o mesmo contrato de tokens (`tokens.json > light`), mantendo tipografia, espaçamento e gradiente. Quando a paleta clara oficial for definida, atualizar este arquivo + `tokens.json` na mesma PR.

Arquivos máquina: `docs/design/tokens.json` (campo `light` — a preencher).

## 3. Componentes

### 3.1 Boas-Vindas Dinâmicas

- Exibir data e horário atuais na página inicial.
- Renderizar **APENAS** os gastos do dia.
- Seletor para navegar para dias anteriores (sem quebrar fluidez — navegação suave).

### 3.2 Dashboard e Gráficos

- Consumir rotas de agregação (mensal e anual) do backend FastAPI.
- Gráficos/tabelas por categoria.
- Tipografia Plus Jakarta Sans em títulos e valores.

### 3.3 Filtros por Categoria

- Botões de filtro rápido por categorias (ex: Gastos Obrigatórios, Lazer, etc.).
- Estado ativo do filtro deve usar destaque primário `#00D2FF` / gradiente em dark.

### 3.4 Rodapé

- Assinatura visível em todas as telas: "Desenvolvido por Bruno Merullo".
- Texto secundário: `#94A3B8` (dark).

## 4. Como os Agentes Devem Usar Este Documento

1. Ler este arquivo + `tokens.json` antes de qualquer tarefa de UI.
2. Não hardcodar cores fora dos tokens — usar variáveis do tema (NativeWind / Tailwind config).
3. Não usar só imagem como fonte de verdade — hex, gradiente e regras acima prevalecem sobre inspeção visual.
4. Qualquer mudança de cor/fonte/espaçamento deve atualizar este arquivo + `tokens.json` + skill na mesma entrega.
5. Comentários no código em Português (o que + porquê), conforme AGENTS.md.

## 5. Screens (referência visual)

Exportar do Figma como PNG (2x) para `docs/design/screens/`:

```text
docs/design/
├── DESIGN.md
├── tokens.json
└── screens/
    ├── 01-home-light.png
    ├── 01-home-dark.png
    ├── 02-dashboard-light.png
    ├── 02-dashboard-dark.png
    └── 03-filtros-categoria.png
```

> A imagem é apoio. A especificação textual + `tokens.json` são obrigatórias porque o agente não deduz hex/espaçamento/behavimento com 100% de certeza só pela imagem.
