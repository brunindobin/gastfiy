/**
 * Provider de autenticação — única fonte de verdade sobre "quem está logado".
 *
 * Ciclo de vida:
 *  1. ao abrir o app, lê token e usuário do armazenamento;
 *  2. valida o token em `GET /auth/eu` (token pode ter expirado);
 *  3. em qualquer 401, limpa a sessão e volta para o login;
 *  4. login/cadastro atualizam token no cliente HTTP + armazenamento.
 *
 * Guardar o usuário em cache local evita tela vazia enquanto o `/auth/eu`
 * responde — a home já pode mostrar a saudação com o nome.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import * as apiAuth from '../api/auth';
import { definirHandlerNaoAutorizado, definirToken } from '../api/client';
import type { Usuario } from '../api/types';
import { lerToken, lerUsuario, removerToken, removerUsuario, salvarToken, salvarUsuario } from '../storage';

type ValorAuth = {
  usuario: Usuario | null;
  carregando: boolean;
  entrar: (email: string, senha: string) => Promise<void>;
  cadastrar: (nome: string, email: string, senha: string) => Promise<void>;
  sair: () => Promise<void>;
};

const AuthContext = createContext<ValorAuth | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [carregando, setCarregando] = useState(true);

  /** Limpa token/usuário de memória, do cliente HTTP e do disco. */
  const limparSessao = useCallback(async () => {
    definirToken(null);
    setUsuario(null);
    await Promise.allSettled([removerToken(), removerUsuario()]);
  }, []);

  // Qualquer 401 em rota autenticada derruba a sessão e volta ao login.
  useEffect(() => {
    definirHandlerNaoAutorizado(() => {
      void limparSessao();
    });
    return () => definirHandlerNaoAutorizado(null);
  }, [limparSessao]);

  // Restauração da sessão na abertura.
  useEffect(() => {
    let ativo = true;

    (async () => {
      try {
        const [token, usuarioSalvo] = await Promise.all([lerToken(), lerUsuario<Usuario>()]);

        if (!token) return;

        // Mostra o usuário em cache imediatamente (home sem espera).
        if (ativo && usuarioSalvo) setUsuario(usuarioSalvo);
        definirToken(token);

        // Confirma com o servidor: token expirado/revogado cai no catch.
        const atual = await apiAuth.buscarUsuarioAtual(token);
        if (!ativo) return;

        setUsuario(atual);
        await salvarUsuario(atual);
      } catch {
        // Qualquer falha aqui significa sessão inválida -> volta ao login.
        if (ativo) await limparSessao();
      } finally {
        if (ativo) setCarregando(false);
      }
    })();

    return () => {
      ativo = false;
    };
  }, [limparSessao]);

  const entrar = useCallback(async (email: string, senha: string) => {
    const resposta = await apiAuth.entrar(email, senha);
    definirToken(resposta.access_token);
    setUsuario(resposta.usuario);
    await Promise.all([salvarToken(resposta.access_token), salvarUsuario(resposta.usuario)]);
  }, []);

  const cadastrar = useCallback(
    async (nome: string, email: string, senha: string) => {
      // O cadastro não devolve token: fazemos o login em seguida para o
      // usuário já entrar no app (menos um passo manual).
      await apiAuth.cadastrar({ nome, email, senha });
      await entrar(email, senha);
    },
    [entrar],
  );

  const sair = useCallback(async () => {
    await limparSessao();
  }, [limparSessao]);

  const valor = useMemo<ValorAuth>(
    () => ({ usuario, carregando, entrar, cadastrar, sair }),
    [usuario, carregando, entrar, cadastrar, sair],
  );

  return <AuthContext.Provider value={valor}>{children}</AuthContext.Provider>;
}

/** Hook de acesso à sessão. Lança se usado fora do provider. */
export function useAuth(): ValorAuth {
  const contexto = useContext(AuthContext);
  if (!contexto) {
    throw new Error('useAuth precisa estar dentro de <AuthProvider>.');
  }
  return contexto;
}
