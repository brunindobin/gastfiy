/**
 * Cliente HTTP único do app.
 *
 * Responsabilidades:
 *  * montar a URL base correta por plataforma (emulador Android x web);
 *  * injetar o Bearer token;
 *  * transformar qualquer falha em `ErroApi` com mensagem amigável em PT-BR;
 *  * aplicar timeout — sem isso, uma rede ruim deixa a tela "carregando" para
 *    sempre, o que o requisito de fluidez proíbe.
 *
 * Nenhuma tela usa `fetch` direto: assim token, timeout e tratamento de erro
 * ficam em um lugar só.
 */

import { Platform } from 'react-native';

import type { DetalheErro } from './types';

/**
 * URL base:
 *  * Android Emulator acessa o host da máquina por 10.0.2.2;
 *  * web/iOS local usam 127.0.0.1;
 *  * produção/dev remoto: definir EXPO_PUBLIC_API_URL no .env do app.
 */
export const BASE_URL =
  process.env.EXPO_PUBLIC_API_URL ??
  (Platform.OS === 'android' ? 'http://10.0.2.2:8000' : 'http://127.0.0.1:8000');

const TIMEOUT_MS = 15000;

let tokenAtual: string | null = null;

/** Callback disparado quando uma requisição autenticada recebe 401. */
let aoNaoAutorizado: (() => void) | null = null;

/** Define/limpa o token usado nas próximas requisições. */
export function definirToken(token: string | null): void {
  tokenAtual = token;
}

/**
 * Registra quem deve reagir a um 401 (o AuthProvider limpa a sessão).
 *
 * Só é chamado quando a requisição ENVIOU token: um 401 no login significa
 * "senha errada", não "sessão expirada", e não deve deslogar ninguém.
 */
export function definirHandlerNaoAutorizado(handler: (() => void) | null): void {
  aoNaoAutorizado = handler;
}

export class ErroApi extends Error {
  status: number;
  codigo: string;
  detalhes: DetalheErro[];

  constructor(mensagem: string, status: number, codigo = 'ERRO', detalhes: DetalheErro[] = []) {
    super(mensagem);
    this.name = 'ErroApi';
    this.status = status;
    this.codigo = codigo;
    this.detalhes = detalhes;
  }

  /** Mensagem pronta para exibir (inclui o primeiro campo inválido, se houver). */
  get mensagemAmigavel(): string {
    if (this.detalhes.length > 0) {
      return `${this.detalhes[0].mensagem} (${this.detalhes[0].campo})`;
    }
    return this.message;
  }
}

type OpcoesRequisicao = {
  metodo?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  corpo?: unknown;
  token?: string | null;
  timeoutMs?: number;
};

/** Faz a requisição e devolve o JSON tipado. Lança `ErroApi` em qualquer falha. */
export async function requisitar<T>(caminho: string, opcoes: OpcoesRequisicao = {}): Promise<T> {
  const { metodo = 'GET', corpo, token = tokenAtual, timeoutMs = TIMEOUT_MS } = opcoes;

  const controlador = new AbortController();
  const timer = setTimeout(() => controlador.abort(), timeoutMs);

  try {
    const resposta = await fetch(`${BASE_URL}${caminho}`, {
      method: metodo,
      headers: {
        Accept: 'application/json',
        ...(corpo ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: corpo ? JSON.stringify(corpo) : undefined,
      signal: controlador.signal,
    });

    // 204 (DELETE) não tem corpo.
    if (resposta.status === 204) return undefined as T;

    const texto = await resposta.text();
    const json = texto ? JSON.parse(texto) : {};

    if (!resposta.ok) {
      // Token expirado/revogado: avisa o AuthProvider (uma vez) para limpar a
      // sessão. O login (sem token) não passa por aqui.
      if (resposta.status === 401 && token) {
        aoNaoAutorizado?.();
      }

      throw new ErroApi(
        json.erro ?? 'Não foi possível concluir a operação.',
        resposta.status,
        json.codigo ?? `HTTP_${resposta.status}`,
        Array.isArray(json.detalhes) ? json.detalhes : [],
      );
    }

    return json as T;
  } catch (erro) {
    if (erro instanceof ErroApi) throw erro;

    if (erro instanceof Error && erro.name === 'AbortError') {
      throw new ErroApi('O servidor demorou demais para responder. Tente novamente.', 0, 'TIMEOUT');
    }

    // Falha de rede: mensagem única, sem detalhe técnico.
    throw new ErroApi(
      'Não foi possível conectar ao servidor. Verifique sua internet.',
      0,
      'SEM_CONEXAO',
    );
  } finally {
    clearTimeout(timer);
  }
}
