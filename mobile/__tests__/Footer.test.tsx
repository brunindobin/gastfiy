/**
 * O rodapé é requisito explícito do produto: a assinatura deve aparecer em
 * todas as telas. Este teste garante que o texto não seja removido sem querer.
 */

import { render, waitFor } from '@testing-library/react-native';

import { Footer } from '../src/components/Footer';
import { ThemeProvider } from '../src/theme/ThemeProvider';

describe('Footer', () => {
  it('exibe a assinatura do desenvolvedor', async () => {
    const { getByText } = await render(
      <ThemeProvider>
        <Footer />
      </ThemeProvider>,
    );

    await waitFor(() => expect(getByText(/Bruno Merullo/)).toBeTruthy());
  });
});
