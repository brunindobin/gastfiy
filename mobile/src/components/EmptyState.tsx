/**
 * Estado vazio reutilizável (sem gastos, sem resultados de filtro, sem dados).
 *
 * Mensagem curta + ação opcional: o usuário entende o que aconteceu e o que
 * fazer em seguida, em vez de olhar para uma tela em branco.
 */

import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useTema } from '../theme/ThemeProvider';
import { espacos, fontes, raios } from '../theme/tokens';

type Props = {
  emoji?: string;
  titulo: string;
  descricao?: string;
  acao?: { rotulo: string; aoPressionar: () => void };
};

export function EmptyState({ emoji = '🗂️', titulo, descricao, acao }: Props) {
  const { cores } = useTema();

  return (
    <View style={styles.container}>
      <Text style={styles.emoji}>{emoji}</Text>
      <Text style={[styles.titulo, { color: cores.textPrimary }]}>{titulo}</Text>
      {descricao ? (
        <Text style={[styles.descricao, { color: cores.textSecondary }]}>{descricao}</Text>
      ) : null}

      {acao ? (
        <Pressable
          accessibilityRole="button"
          onPress={acao.aoPressionar}
          style={({ pressed }) => [
            styles.botao,
            { borderColor: cores.primary, opacity: pressed ? 0.7 : 1 },
          ]}
        >
          <Text style={[styles.botaoTexto, { color: cores.primary }]}>{acao.rotulo}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: espacos.xxl,
    paddingHorizontal: espacos.lg,
  },
  emoji: { fontSize: 40, marginBottom: espacos.md },
  titulo: {
    fontFamily: fontes.semiBold,
    fontSize: 16,
    textAlign: 'center',
    marginBottom: espacos.xs,
  },
  descricao: {
    fontFamily: fontes.regular,
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 280,
  },
  botao: {
    marginTop: espacos.lg,
    borderWidth: 1,
    borderRadius: raios.pill,
    paddingHorizontal: espacos.xl,
    paddingVertical: espacos.sm + 2,
  },
  botaoTexto: { fontFamily: fontes.semiBold, fontSize: 13 },
});
