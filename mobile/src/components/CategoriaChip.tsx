/**
 * Chip de categoria (selecionável).
 *
 * Usado no formulário de gasto e nos filtros. A cor vem do token da categoria
 * para o usuário reconhecer "Lazer" pela cor mesmo sem ler o rótulo.
 */

import { Pressable, StyleSheet, Text } from 'react-native';

import { useTema } from '../theme/ThemeProvider';
import { dadosCategoria, espacos, fontes, raios } from '../theme/tokens';

type Props = {
  categoria: string;
  selecionada: boolean;
  aoPressionar: (categoria: string) => void;
};

export function CategoriaChip({ categoria, selecionada, aoPressionar }: Props) {
  const { cores } = useTema();
  const dados = dadosCategoria(categoria);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: selecionada }}
      accessibilityLabel={dados.rotulo}
      onPress={() => aoPressionar(categoria)}
      style={({ pressed }) => [
        styles.chip,
        {
          backgroundColor: selecionada ? `${dados.cor}26` : cores.surface,
          borderColor: selecionada ? dados.cor : cores.borderSubtle,
          opacity: pressed ? 0.75 : 1,
        },
      ]}
    >
      <Text style={styles.emoji}>{dados.emoji}</Text>
      <Text
        style={[
          styles.texto,
          { color: selecionada ? dados.cor : cores.textSecondary },
          selecionada && styles.textoForte,
        ]}
        numberOfLines={1}
      >
        {dados.rotulo}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacos.xs + 2,
    borderWidth: 1,
    borderRadius: raios.pill,
    paddingHorizontal: espacos.md,
    paddingVertical: espacos.sm,
    marginRight: espacos.sm,
    marginBottom: espacos.sm,
  },
  emoji: { fontSize: 14 },
  texto: { fontFamily: fontes.medium, fontSize: 13 },
  textoForte: { fontFamily: fontes.semiBold },
});
