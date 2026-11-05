# GASTIFY — App Android (Expo + React Native + TypeScript)

Aplicativo de gestão financeira pessoal que consome a API do GASTIFY
(`../backend`). Construído com **Expo SDK 58**, **React Native 0.88** e
**TypeScript estrito**.

---

## 1. Funcionalidades

| Tela | O que faz |
| :--- | :--- |
| **Login / Criar conta** | autenticação JWT; erros amigáveis em PT-BR; token no `expo-secure-store` |
| **Início** | saudação dinâmica (Bom dia/Boa tarde/Boa noite) + data e hora atuais; **somente gastos do dia**; seletor de dias anteriores; total do dia; pull-to-refresh; FAB |
| **Novo/Editar gasto** | nome, valor com máscara R$, data com máscara DD/MM/AAAA, 7 categorias com cor/emoji; excluir com confirmação |
| **Dashboard** | visão **mensal** e **anual**; barras por dia/mês; rosca por categoria; total, lançamentos e média |
| **Filtros** | busca por nome, intervalo de datas, multi-seleção de categorias e paginação incremental |
| **Ajustes** | tema **Escuro / Claro / Sistema** (persistido), dados da conta, versão, logout |

Rodapé **"Desenvolvido por Bruno Merullo"** presente em todas as telas.

---

## 2. Estrutura

```text
mobile/
├── App.tsx                    # providers (SafeArea, Tema, Auth) + navegação
├── index.ts                   # entrada do Expo
├── src/
│   ├── api/
│   │   ├── client.ts          # fetch tipado, timeout, token, ErroApi
│   │   ├── auth.ts            # login, cadastro, /auth/eu
│   │   ├── gastos.ts          # CRUD + filtros/paginação
│   │   ├── agregacoes.ts      # resumo, mensal, anual
│   │   └── types.ts           # contrato da API (docs/API.md)
│   ├── auth/AuthProvider.tsx  # sessão, restauração e logout em 401
│   ├── components/            # Tela, Footer, GastoCard, CategoriaChip, CampoTexto,
│   │                          # Botao, EmptyState, SeletorDia, Graficos
│   ├── navigation/            # AppNavigator (stack + abas) e tipos
│   ├── screens/               # Login, Home, NovoGasto, Dashboard, Filtros, Ajustes
│   ├── theme/                 # tokens (dark/light) + ThemeProvider
│   ├── utils/formato.ts       # moeda, datas, saudação, máscaras
│   └── storage.ts             # SecureStore (token) + AsyncStorage (preferências)
├── __tests__/                 # Jest + Testing Library
└── jest.setup.ts              # mocks de nativos
```

---

## 3. Como rodar

### 3.1 Instalar

```powershell
cd mobile
npm install
```

> Node 20+ (validado em Node 26). O projeto usa `npm` (há `package-lock.json`).

### 3.2 Configurar a URL da API

Por padrão:

- **Emulador Android** → `http://10.0.2.2:8000` (host da máquina)
- **Web / iOS** → `http://127.0.0.1:8000`

Para apontar para outra máquina, crie `mobile/.env`:

```env
EXPO_PUBLIC_API_URL=http://192.168.0.10:8000
```

### 3.3 Rodar

```powershell
npm start            # abre o Expo Dev Server (QR Code / menu)
npm run android      # abre no emulador/dispositivo Android
npm run web          # versão web para inspeção rápida
```

> A API precisa estar no ar (`cd ../backend; uvicorn app.main:app --reload`).

---

## 4. Testes e verificação

```powershell
npm test             # 35 testes (Jest + Testing Library)
npm run typecheck    # tsc --noEmit (strict)
npm run export:web   # prova que o bundle gera sem erro
```

Cobertura atual:

- utilitários puros (moeda, datas, máscaras, saudação);
- `GastoCard`, `CategoriaChip` e `Footer`;
- `ThemeProvider` (troca de tema e paleta aplicada);
- cliente HTTP (token, 204, 422, 401, falha de rede);
- `HomeScreen` (gastos do dia, total, estado vazio, FAB, erro amigável).

Os testes usam **dublês** para a API e para a navegação — nenhum teste depende
de backend no ar.

---

## 5. Decisões de design

- **Design system "Obsidian Lumina"** (`../docs/design`): fundo `#0A0E18`,
  superfícies `#0F131D`/`#171B26`, cyan `#00D2FF` e indigo `#6366F1`.
- **Tema claro derivado**: o design oficial só existe no escuro. Foi criada uma
  paleta clara neutra (`#F6F8FC` / `#FFFFFF`) mantendo cyan e indigo, com
  contraste ajustado para leitura (cyan escurecido para `#0099CC`).
- **Tipografia**: Plus Jakarta Sans (400/500/600/700) via `@expo-google-fonts`.
- **Estilo**: `StyleSheet` + tokens tipados (sem NativeWind/Tailwind), o que
  reduz risco de build e mantém o bundle leve.
- **Gráficos**: `react-native-svg` com barras e rosca próprias — sem lib pesada.
- **Performance**: `FlatList` virtualizada, `GastoCard` com `memo`, somas feitas
  no backend, timeout de 15 s em toda requisição.

---

## 6. Segurança

- Token JWT guardado no **SecureStore** (Keystore no Android). No web, fallback
  para AsyncStorage (apenas desenvolvimento).
- Nenhuma credencial no código: só `EXPO_PUBLIC_API_URL`.
- Todo 401 em rota autenticada limpa a sessão e volta ao login.
- Erros sempre em texto amigável; nenhum stack trace ou JSON cru na tela.

---

## 7. Limitações da v1

- Não há build `.apk`/`.aab` assinado neste repositório — o app roda via **Expo
  Go** ou `npm run android` com emulador. Para publicar, use `eas build`.
- Sem testes E2E em emulador (a validação de UI é feita com Testing Library).
- O tema claro é uma derivação documentada, não um design oficial.

---

Desenvolvido por **Bruno Merullo**.
