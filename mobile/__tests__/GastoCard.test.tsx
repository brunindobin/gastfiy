/**
 * Testes do card de gasto.
 *
 * Verificam o que o usuário vê (nome, categoria, valor) e o comportamento de
 * toque que leva para a edição.
 *
 * Nota: no @testing-library/react-native 14, `render` e `fireEvent` são
 * assíncronos — por isso todo teste é `async` e usa `await`.
 */

import type { ReactElement } from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';

import { GastoCard } from '../src/components/GastoCard';
import { ThemeProvider } from '../src/theme/ThemeProvider';
import type { Gasto } from '../src/api/types';
import { hojeISO } from '../src/utils/formato';

const gasto: Gasto = {
  id: '11111111-1111-1111-1111-111111111111',
  nome: 'Café da manhã',
  valor: 12.5,
  data: hojeISO(),
  categoria: 'alimentacao',
  categoria_rotulo: 'Alimentação',
  criado_em: '2026-11-05T10:00:00Z',
  atualizado_em: '2026-11-05T10:00:00Z',
};

function renderizar(componente: ReactElement) {
  return render(<ThemeProvider>{componente}</ThemeProvider>);
}

describe('GastoCard', () => {
  it('mostra nome, categoria e valor formatado', async () => {
    const { getByText } = await renderizar(<GastoCard gasto={gasto} />);

    await waitFor(() => expect(getByText('Café da manhã')).toBeTruthy());
    expect(getByText('Alimentação')).toBeTruthy();
    expect(getByText('R$ 12,50')).toBeTruthy();
  });

  it('exibe a data quando o gasto não é de hoje', async () => {
    const { getByText } = await renderizar(
      <GastoCard gasto={{ ...gasto, data: '2026-10-01' }} />,
    );

    await waitFor(() => expect(getByText('Alimentação · 01/10/2026')).toBeTruthy());
  });

  it('avisa ao toque qual gasto foi selecionado', async () => {
    const aoPressionar = jest.fn();
    const { getByText } = await renderizar(
      <GastoCard gasto={gasto} aoPressionar={aoPressionar} />,
    );

    await waitFor(() => expect(getByText('Café da manhã')).toBeTruthy());
    await fireEvent.press(getByText('Café da manhã'));

    expect(aoPressionar).toHaveBeenCalledWith(gasto);
  });
});
