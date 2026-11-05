/**
 * Card de um gasto na lista.
 *
 * `memo` é intencional: a home pode ter dezenas de itens e digitar/filtrar não
 * deve re-renderizar todos. As props são primitivas/objeto estável, então a
 * comparação rasa do React funciona bem.
 */

import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useTema } from '../theme/ThemeProvider';
import { dadosCategoria, espacos, fontes, raios } from '../theme/tokens';
import type { Gasto } from '../api/types';
import { formatarData, formatarMoeda, hojeISO } from '../utils/formato';

type Props = {
  gasto: Gasto;
  aoPressionar?: (gasto: Gasto) => void;
};

export const GastoCard = memo(function GastoCard({ gasto, aoPressionar }: Props) {
  const { cores } = useTema();
  const dados = dadosCategoria(gasto.categoria);
  const mostrarData = gasto.data !== hojeISO();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${gasto.nome}, ${formatarMoeda(gasto.valor)}`}
      onPress={() => aoPressionar?.(gasto)}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: cores.surface,
          borderColor: cores.borderSubtle,
          opacity: pressed ? 0.8 : 1,
        },
      ]}
    >
      <View style={[styles.icone, { backgroundColor: `${dados.cor}22` }]}>
        <Text style={styles.emoji}>{dados.emoji}</Text>
      </View>

      <View style={styles.info}>
        <Text style={[styles.nome, { color: cores.textPrimary }]} numberOfLines={1}>
          {gasto.nome}
        </Text>
        <Text style={[styles.categoria, { color: cores.textSecondary }]} numberOfLines={1}>
          {dados.rotulo}
          {mostrarData ? ` · ${formatarData(gasto.data)}` : ''}
        </Text>
      </View>

      <Text style={[styles.valor, { color: cores.textPrimary }]}>
        {formatarMoeda(gasto.valor)}
      </Text>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacos.md,
    borderWidth: 1,
    borderRadius: raios.md,
    padding: espacos.md,
    marginBottom: espacos.sm,
  },
  icone: {
    width: 42,
    height: 42,
    borderRadius: raios.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emoji: { fontSize: 20 },
  info: { flex: 1 },
  nome: { fontFamily: fontes.semiBold, fontSize: 15 },
  categoria: { fontFamily: fontes.regular, fontSize: 12, marginTop: 2 },
  valor: { fontFamily: fontes.bold, fontSize: 15 },
});
