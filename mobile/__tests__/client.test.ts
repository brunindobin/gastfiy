/**
 * Testes do cliente HTTP.
 *
 * Cobrem o que pode causar bug silencioso: token não enviado, erro do backend
 * virando mensagem técnica na tela e 401 não deslogando o usuário.
 */

import {
  definirHandlerNaoAutorizado,
  definirToken,
  ErroApi,
  requisitar,
} from '../src/api/client';

/** Cria uma resposta mínima no formato que o cliente consome. */
function resposta(status: number, corpo?: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => (corpo === undefined ? '' : JSON.stringify(corpo)),
  };
}

const fetchMock = () => global.fetch as unknown as jest.Mock;

beforeEach(() => {
  global.fetch = jest.fn() as unknown as typeof fetch;
  definirToken(null);
  definirHandlerNaoAutorizado(null);
});

describe('requisitar', () => {
  it('envia o token no header Authorization', async () => {
    definirToken('token-123');
    fetchMock().mockResolvedValue(resposta(200, { total: 0, itens: [] }));

    const dados = await requisitar<{ total: number }>('/api/v1/gastos');

    expect(dados.total).toBe(0);
    const [, opcoes] = fetchMock().mock.calls[0];
    expect(opcoes.headers.Authorization).toBe('Bearer token-123');
    expect(opcoes.headers['Content-Type']).toBeUndefined();
  });

  it('envia JSON quando há corpo', async () => {
    fetchMock().mockResolvedValue(resposta(201, { id: 'abc' }));

    await requisitar('/api/v1/gastos', { metodo: 'POST', corpo: { nome: 'Café' } });

    const [, opcoes] = fetchMock().mock.calls[0];
    expect(opcoes.method).toBe('POST');
    expect(opcoes.headers['Content-Type']).toBe('application/json');
    expect(opcoes.body).toBe(JSON.stringify({ nome: 'Café' }));
  });

  it('devolve undefined em 204 (DELETE)', async () => {
    fetchMock().mockResolvedValue(resposta(204));

    await expect(requisitar('/api/v1/gastos/1', { metodo: 'DELETE' })).resolves.toBeUndefined();
  });

  it('converte erro do backend em ErroApi amigável', async () => {
    fetchMock().mockResolvedValue(
      resposta(422, {
        erro: 'Dados inválidos',
        codigo: 'VALIDACAO',
        detalhes: [{ campo: 'valor', mensagem: 'Deve ser maior que 0.' }],
      }),
    );

    expect.assertions(4);
    try {
      await requisitar('/api/v1/gastos', { metodo: 'POST', corpo: {} });
    } catch (erro) {
      expect(erro).toBeInstanceOf(ErroApi);
      const erroApi = erro as ErroApi;
      expect(erroApi.status).toBe(422);
      expect(erroApi.codigo).toBe('VALIDACAO');
      expect(erroApi.mensagemAmigavel).toBe('Deve ser maior que 0. (valor)');
    }
  });

  it('avisa o handler quando um 401 acontece em rota autenticada', async () => {
    definirToken('token-expirado');
    const aoNaoAutorizado = jest.fn();
    definirHandlerNaoAutorizado(aoNaoAutorizado);
    fetchMock().mockResolvedValue(
      resposta(401, { erro: 'Sessão expirada.', codigo: 'TOKEN_EXPIRADO' }),
    );

    await expect(requisitar('/api/v1/gastos')).rejects.toBeInstanceOf(ErroApi);
    expect(aoNaoAutorizado).toHaveBeenCalledTimes(1);
  });

  it('não desloga quando o 401 é do próprio login', async () => {
    const aoNaoAutorizado = jest.fn();
    definirHandlerNaoAutorizado(aoNaoAutorizado);
    fetchMock().mockResolvedValue(
      resposta(401, { erro: 'E-mail ou senha inválidos.', codigo: 'CREDENCIAIS_INVALIDAS' }),
    );

    await expect(requisitar('/api/v1/auth/login', { metodo: 'POST', corpo: {} })).rejects.toBeInstanceOf(
      ErroApi,
    );
    expect(aoNaoAutorizado).not.toHaveBeenCalled();
  });

  it('traduz falha de rede em mensagem sem detalhe técnico', async () => {
    fetchMock().mockRejectedValue(new TypeError('Network request failed'));

    expect.assertions(3);
    try {
      await requisitar('/api/v1/gastos');
    } catch (erro) {
      const erroApi = erro as ErroApi;
      expect(erroApi).toBeInstanceOf(ErroApi);
      expect(erroApi.codigo).toBe('SEM_CONEXAO');
      expect(erroApi.mensagemAmigavel).not.toContain('Network');
    }
  });
});
