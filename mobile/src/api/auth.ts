/**
 * Chamadas de autenticação.
 *
 * Ficam separadas do cliente HTTP para que as telas expressem a intenção
 * ("entrar", "cadastrar") sem montar caminho nem corpo de requisição.
 */

import { requisitar } from './client';
import type { RespostaLogin, Usuario } from './types';

export type DadosCadastro = {
  nome: string;
  email: string;
  senha: string;
};

/** POST /api/v1/auth/login — devolve token + dados do usuário. */
export function entrar(email: string, senha: string): Promise<RespostaLogin> {
  return requisitar<RespostaLogin>('/api/v1/auth/login', {
    metodo: 'POST',
    corpo: { email: email.trim(), senha },
  });
}

/** POST /api/v1/auth/registrar — cria a conta (não devolve token). */
export function cadastrar(dados: DadosCadastro): Promise<Usuario> {
  return requisitar<Usuario>('/api/v1/auth/registrar', {
    metodo: 'POST',
    corpo: { nome: dados.nome.trim(), email: dados.email.trim(), senha: dados.senha },
  });
}

/**
 * GET /api/v1/auth/eu — valida se o token salvo ainda vale.
 * Chamado na abertura do app; um 401 significa "faça login de novo".
 */
export function buscarUsuarioAtual(token: string): Promise<Usuario> {
  return requisitar<Usuario>('/api/v1/auth/eu', { token });
}
