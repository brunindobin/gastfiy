/**
 * Seletor de dia da home: ‹ Ontem | Hoje | 03/11 ›.
 *
 * Regra do produto: só é possível navegar até HOJE — o backend recusa data
 * futura, então o botão "próximo" fica desabilitado quando já estamos no dia
 * atual (feedback claro em vez de erro na requisição).
 */

import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useTema } from '../theme/ThemeProvider';
import { espacos, fontes, raios } from '../theme/tokens';
import { formatarDataPorExtenso, hojeISO, rotuloDoDia, somarDiasISO } from '../utils/formato';

type Props = {
  data: string;
  aoMudar: (novaData: string) => void;
};

export function SeletorDia({ data, aoMudar }: Props) {
  const { cores } = useTema();
  const hoje = hojeISO();
  const podeAvancar = data < hoje;

  return (
    <View style={[styles.container, { backgroundColor: cores.surface, borderColor: cores.borderSubtle }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Dia anterior"
        onPress={() => aoMudar(somarDiasISO(data, -1))}
        style={({ pressed }) => [styles.seta, { opacity: pressed ? 0.6 : 1 }]}
        hitSlop={8}
      >
        <Text style={[styles.setaTexto, { color: cores.primary }]}>‹</Text>
      </Pressable>

      <View style={styles.centro}>
        <Text style={[styles.dia, { color: cores.textPrimary }]}>{rotuloDoDia(data)}</Text>
        <Text style={[styles.extenso, { color: cores.textSecondary }]} numberOfLines={1}>
          {formatarDataPorExtenso(data)}
        </Text>
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Próximo dia"
        accessibilityState={{ disabled: !podeAvancar }}
        disabled={!podeAvancar}
        onPress={() => aoMudar(somarDiasISO(data, 1))}
        style={({ pressed }) => [styles.seta, { opacity: !podeAvancar ? 0.25 : pressed ? 0.6 : 1 }]}
        hitSlop={8}
      >
        <Text style={[styles.setaTexto, { color: cores.primary }]}>›</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: raios.md,
    paddingVertical: espacos.sm,
    paddingHorizontal: espacos.sm,
  },
  seta: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  setaTexto: { fontFamily: fontes.bold, fontSize: 24, lineHeight: 26 },
  centro: { flex: 1, alignItems: 'center' },
  dia: { fontFamily: fontes.semiBold, fontSize: 15 },
  extenso: { fontFamily: fontes.regular, fontSize: 11, marginTop: 1 },
});
