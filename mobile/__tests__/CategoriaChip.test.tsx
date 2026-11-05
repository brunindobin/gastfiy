/**
 * Testes do chip de categoria: seleção visual e callback.
 */

import type { ReactElement } from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';

import { CategoriaChip } from '../src/components/CategoriaChip';
import { ThemeProvider } from '../src/theme/ThemeProvider';

function renderizar(componente: ReactElement) {
  return render(<ThemeProvider>{componente}</ThemeProvider>);
}

describe('CategoriaChip', () => {
  it('mostra o rótulo amigável da categoria', async () => {
    const { getByText } = await renderizar(
      <CategoriaChip categoria="lazer" selecionada={false} aoPressionar={jest.fn()} />,
    );

    await waitFor(() => expect(getByText('Lazer')).toBeTruthy());
  });

  it('devolve o slug ao ser tocado', async () => {
    const aoPressionar = jest.fn();
    const { getByText } = await renderizar(
      <CategoriaChip categoria="saude" selecionada={false} aoPressionar={aoPressionar} />,
    );

    await waitFor(() => expect(getByText('Saúde')).toBeTruthy());
    await fireEvent.press(getByText('Saúde'));

    expect(aoPressionar).toHaveBeenCalledWith('saude');
  });

  it('marca o estado selecionado para acessibilidade', async () => {
    const { getByLabelText } = await renderizar(
      <CategoriaChip categoria="transporte" selecionada aoPressionar={jest.fn()} />,
    );

    await waitFor(() => {
      const chip = getByLabelText('Transporte');
      expect(chip.props.accessibilityState).toEqual({ selected: true });
    });
  });
});
