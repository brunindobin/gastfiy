/**
 * Layout base das telas: área segura + fundo do tema + rodapé fixo.
 *
 * Centralizar isso evita repetir `SafeAreaView`/`backgroundColor`/`Footer` em
 * cada tela e garante que a assinatura nunca "desapareça" em uma tela nova.
 */

import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useTema } from '../theme/ThemeProvider';
import { Footer } from './Footer';

type Props = {
  children: ReactNode;
  /** Quando false, o conteúdo não recebe padding (listas cuidam disso). */
  comPadding?: boolean;
};

export function Tela({ children, comPadding = true }: Props) {
  const { cores } = useTema();

  return (
    <SafeAreaView
      style={[styles.safe, { backgroundColor: cores.background }]}
      edges={['top', 'left', 'right']}
    >
      <View style={[styles.conteudo, comPadding && styles.padding]}>{children}</View>
      <Footer />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  conteudo: { flex: 1 },
  padding: { paddingHorizontal: 16, paddingTop: 8 },
});
