/**
 * Provider de tema (Escuro / Claro / Sistema).
 *
 * Decisões:
 *  * O modo escolhido é persistido em AsyncStorage (`gastify.tema`) para o app
 *    abrir já com a preferência do usuário.
 *  * "Sistema" segue o `useColorScheme()` do aparelho e reage a mudanças em
 *    tempo real (o usuário troca o tema do Android e o app acompanha).
 *  * O provider entrega a paleta pronta (`cores`) — nenhuma tela precisa saber
 *    se está no claro ou no escuro, só usa os tokens.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useColorScheme } from 'react-native';

import { lerTema, salvarTema } from '../storage';
import { fontes, paletaClara, paletaEscura, type Paleta } from './tokens';

export type ModoTema = 'claro' | 'escuro' | 'sistema';
export type Esquema = 'claro' | 'escuro';

type ValorTema = {
  /** Modo escolhido pelo usuário. */
  modo: ModoTema;
  /** Esquema realmente aplicado (resolve "sistema"). */
  esquema: Esquema;
  /** Paleta de cores do esquema atual. */
  cores: Paleta;
  fontes: typeof fontes;
  /** Troca o modo e persiste a escolha. */
  definirModo: (modo: ModoTema) => Promise<void>;
  /** True até ler a preferência salva (evita "piscar" o tema errado). */
  carregando: boolean;
};

const TemaContext = createContext<ValorTema | null>(null);

const CHAVE_ANTIGA = 'gastify.tema';

export function ThemeProvider({ children }: { children: ReactNode }) {
  const esquemaSistema = useColorScheme();
  const [modo, setModo] = useState<ModoTema>('sistema');
  const [carregando, setCarregando] = useState(true);

  // Lê a preferência salva apenas uma vez, na montagem.
  useEffect(() => {
    let ativo = true;

    (async () => {
      try {
        const salvo = (await lerTema()) as ModoTema | null;
        if (ativo && (salvo === 'claro' || salvo === 'escuro' || salvo === 'sistema')) {
          setModo(salvo);
        }
      } catch {
        // Falha ao ler preferência não pode impedir o app de abrir.
      } finally {
        if (ativo) setCarregando(false);
      }
    })();

    return () => {
      ativo = false;
    };
  }, []);

  const definirModo = useCallback(async (novo: ModoTema) => {
    setModo(novo);
    try {
      await salvarTema(novo);
    } catch {
      // Persistir é conveniência: se falhar, o tema vale só nesta sessão.
    }
  }, []);

  const esquema: Esquema =
    modo === 'sistema' ? (esquemaSistema === 'dark' ? 'escuro' : 'claro') : modo;

  const valor = useMemo<ValorTema>(
    () => ({
      modo,
      esquema,
      cores: esquema === 'escuro' ? paletaEscura : paletaClara,
      fontes,
      definirModo,
      carregando,
    }),
    [modo, esquema, definirModo, carregando],
  );

  return <TemaContext.Provider value={valor}>{children}</TemaContext.Provider>;
}

/** Hook de acesso ao tema. Lança se usado fora do provider (erro de código). */
export function useTema(): ValorTema {
  const contexto = useContext(TemaContext);
  if (!contexto) {
    throw new Error('useTema precisa estar dentro de <ThemeProvider>.');
  }
  return contexto;
}

/** Remove a chave legada (caso exista de versões anteriores do app). */
export async function limparTemaLegado(): Promise<void> {
  try {
    await AsyncStorage.removeItem(CHAVE_ANTIGA);
  } catch {
    // Sem consequência funcional.
  }
}
