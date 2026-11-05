/**
 * Testes do ThemeProvider: modo escolhido, resolução de "sistema" e
 * persistência da preferência.
 */

import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { Pressable, Text, View } from 'react-native';

import { ThemeProvider, useTema } from '../src/theme/ThemeProvider';

/** Componente de sondagem: expõe o estado do tema em texto. */
function Sonda() {
  const { modo, esquema, definirModo, cores } = useTema();

  return (
    <View>
      <Text>{`modo=${modo}`}</Text>
      <Text>{`esquema=${esquema}`}</Text>
      <Text>{`fundo=${cores.background}`}</Text>
      <Pressable accessibilityRole="button" onPress={() => void definirModo('claro')}>
        <Text>Usar claro</Text>
      </Pressable>
      <Pressable accessibilityRole="button" onPress={() => void definirModo('escuro')}>
        <Text>Usar escuro</Text>
      </Pressable>
    </View>
  );
}

describe('ThemeProvider', () => {
  it('inicia no modo sistema e aplica a paleta clara', async () => {
    const { getByText } = await render(
      <ThemeProvider>
        <Sonda />
      </ThemeProvider>,
    );

    await waitFor(() => expect(getByText('modo=sistema')).toBeTruthy());
    expect(getByText('esquema=claro')).toBeTruthy();
    expect(getByText('fundo=#F6F8FC')).toBeTruthy();
  });

  it('troca para o tema escuro e muda a paleta', async () => {
    const { getByText } = await render(
      <ThemeProvider>
        <Sonda />
      </ThemeProvider>,
    );

    await waitFor(() => expect(getByText('modo=sistema')).toBeTruthy());
    await fireEvent.press(getByText('Usar escuro'));

    await waitFor(() => expect(getByText('modo=escuro')).toBeTruthy());
    expect(getByText('esquema=escuro')).toBeTruthy();
    expect(getByText('fundo=#0A0E18')).toBeTruthy();
  });

  it('volta para o tema claro', async () => {
    const { getByText } = await render(
      <ThemeProvider>
        <Sonda />
      </ThemeProvider>,
    );

    await waitFor(() => expect(getByText('modo=sistema')).toBeTruthy());
    await fireEvent.press(getByText('Usar claro'));

    await waitFor(() => expect(getByText('modo=claro')).toBeTruthy());
    expect(getByText('esquema=claro')).toBeTruthy();
  });
});
