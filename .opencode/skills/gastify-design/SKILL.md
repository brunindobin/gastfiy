---
name: GASTIFY Design
description: Design system Obsidian Lumina do GASTIFY - Plus Jakarta Sans, cores dark, tokens e regras de UI. Carregar antes de qualquer tarefa de frontend/mobile.
---

## Regra principal
Antes de implementar qualquer tela, ler a fonte da verdade:
- `docs/design/DESIGN.md`
- `docs/design/tokens.json`

Nunca inventar cor, fonte ou espaçamento fora dos tokens. A imagem em `docs/design/screens/` (se existir) é só apoio visual — hex, gradiente e regras textuais prevalecem.

## Produto
- **Nome:** Gastify — gestão e controle financeiro diário, simples e rápido.
- **Tipografia:** Plus Jakarta Sans, sans-serif.
- **Stack alvo:** React Native / Expo + NativeWind ou Next.js Mobile-First + Tailwind CSS.

## Dark Mode — Obsidian Lumina (tema principal)
- Fundo: `#0A0E18`
- Superfície / Cards & Modais: `#0F131D`
- Superfície Elevada / Inputs: `#171B26` / `#1E293B`
- Bordas Sutis: `#1E293B` / `#334155`
- Destaque Primário (Neon/Cyan): `#00D2FF`
- Acento Secundário (Indigo/Violet): `#6366F1`
- Gradiente: `linear-gradient(135deg, #00D2FF 0%, #6366F1 100%)`
- Texto Principal: `#F8FAFC`
- Texto Secundário / Labels: `#94A3B8`

## Light Mode
Pendente de especificação oficial. Manter mesmo contrato de tokens, tipografia e gradiente. Não inventar paleta clara.

## Regras de UI obrigatórias
- Página Inicial: boas-vindas dinâmicas com data/horário, **apenas gastos do dia**, seletor para dias anteriores.
- Dashboard: gráficos/tabelas com agregações mensal/anual do backend.
- Filtros: botões de filtro rápido por categoria.
- Rodapé: "Desenvolvido por Bruno Merullo" em todas as telas.
- App com opção de modo dark e modo claro.
- Fluidez máxima, sem travamentos. Comentários em Português no código.

## Mudanças no design
Toda alteração deve atualizar na mesma entrega: `docs/design/DESIGN.md` + `docs/design/tokens.json` + esta skill.
