/**
 * Testes da tela inicial.
 *
 * Validam a regra central do produto (mostrar apenas os gastos do dia
 * selecionado), o total somado e o atalho para criar um gasto.
 *
 * A navegação e a sessão são dubladas: o objetivo aqui é a tela, não o
 * React Navigation nem o backend.
 */

import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { HomeScreen } from '../src/screens/HomeScreen';
import { ThemeProvider } from '../src/theme/ThemeProvider';
import type { Gasto } from '../src/api/types';
import { hojeISO } from '../src/utils/formato';

const mockNavegar = jest.fn();

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavegar }),
  useFocusEffect: (callback: () => void) => {
    const { useEffect } = require('react');
    useEffect(() => {
      callback();
    }, [callback]);
  },
}));

jest.mock('../src/auth/AuthProvider', () => ({
  useAuth: () => ({
    usuario: {
      id: 'usuario-1',
      nome: 'Bruno Merullo',
      email: 'bruno@gastify.dev',
      criado_em: '2026-01-01T00:00:00Z',
    },
    carregando: false,
    entrar: jest.fn(),
    cadastrar: jest.fn(),
    sair: jest.fn(),
  }),
}));

jest.mock('../src/api/gastos', () => ({
  listarGastos: jest.fn(),
}));

// Importado depois do mock para receber a versão dublada.
import { listarGastos } from '../src/api/gastos';

const listarMock = listarGastos as unknown as jest.Mock;

const gastoDoDia: Gasto = {
  id: 'gasto-1',
  nome: 'Café da manhã',
  valor: 12.5,
  data: hojeISO(),
  categoria: 'alimentacao',
  categoria_rotulo: 'Alimentação',
  criado_em: '2026-11-05T10:00:00Z',
  atualizado_em: '2026-11-05T10:00:00Z',
};

const metricas = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
};

function renderizar() {
  return render(
    <SafeAreaProvider initialMetrics={metricas}>
      <ThemeProvider>
        <HomeScreen />
      </ThemeProvider>
    </SafeAreaProvider>,
  );
}

beforeEach(() => {
  mockNavegar.mockClear();
  listarMock.mockReset();
});

describe('HomeScreen', () => {
  it('carrega os gastos do dia atual e mostra o total', async () => {
    listarMock.mockResolvedValue({ total: 1, itens: [gastoDoDia] });

    const { findByText, getAllByText } = await renderizar();

    expect(await findByText('Café da manhã')).toBeTruthy();
    expect(getAllByText('R$ 12,50').length).toBeGreaterThan(0);

    // A home pede explicitamente o dia de hoje e o limite máximo da API.
    expect(listarMock).toHaveBeenCalledWith(
      expect.objectContaining({ data: hojeISO(), limite: 200 }),
    );
  });

  it('mostra o estado vazio quando não há gastos no dia', async () => {
    listarMock.mockResolvedValue({ total: 0, itens: [] });

    const { findByText } = await renderizar();

    expect(await findByText('Nenhum gasto neste dia')).toBeTruthy();
  });

  it('abre a criação de gasto pelo botão flutuante', async () => {
    listarMock.mockResolvedValue({ total: 0, itens: [] });

    const { findByLabelText } = await renderizar();

    const fab = await findByLabelText('Novo gasto');
    await fireEvent.press(fab);

    expect(mockNavegar).toHaveBeenCalledWith('NovoGasto');
  });

  it('abre a edição ao tocar em um gasto da lista', async () => {
    listarMock.mockResolvedValue({ total: 1, itens: [gastoDoDia] });

    const { findByText } = await renderizar();

    await fireEvent.press(await findByText('Café da manhã'));

    expect(mockNavegar).toHaveBeenCalledWith('NovoGasto', { gasto: gastoDoDia });
  });

  it('mostra mensagem amigável quando a API falha', async () => {
    const { ErroApi } = require('../src/api/client');
    listarMock.mockRejectedValue(new ErroApi('Servidor indisponível.', 503, 'BANCO_INDISPONIVEL'));

    const { findByText } = await renderizar();

    expect(await findByText('Servidor indisponível.')).toBeTruthy();
    expect(await findByText('Toque para tentar de novo')).toBeTruthy();
  });
});
