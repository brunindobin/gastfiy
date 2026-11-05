/**
 * Rodapé com a assinatura do produto.
 *
 * Presente em TODAS as telas (requisito do projeto). Fica em um componente
 * único para não haver divergência de texto/estilo entre telas.
 */

import { StyleSheet, Text, View } from 'react-native';

import { useTema } from '../theme/ThemeProvider';
import { espacos, fontes } from '../theme/tokens';

export function Footer() {
  const { cores } = useTema();

  return (
    <View style={[styles.container, { borderTopColor: cores.borderSubtle }]}>
      <Text style={[styles.texto, { color: cores.textSecondary }]}>
        Desenvolvido por <Text style={[styles.nome, { color: cores.primary }]}>Bruno Merullo</Text>
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: espacos.md,
    paddingHorizontal: espacos.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
  },
  texto: {
    fontFamily: fontes.regular,
    fontSize: 12,
    letterSpacing: 0.2,
  },
  nome: {
    fontFamily: fontes.semiBold,
  },
});
