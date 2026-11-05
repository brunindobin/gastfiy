/**
 * Botão principal com gradiente e estado de carregamento.
 *
 * `desabilitado` cobre dois casos: formulário inválido e requisição em
 * andamento. Sem isso, o usuário poderia tocar duas vezes e criar duplicata.
 */

import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { useTema } from '../theme/ThemeProvider';
import { espacos, fontes, gradiente, raios } from '../theme/tokens';

type Props = {
  titulo: string;
  aoPressionar: () => void;
  carregando?: boolean;
  desabilitado?: boolean;
  variante?: 'primario' | 'secundario';
};

export function Botao({
  titulo,
  aoPressionar,
  carregando = false,
  desabilitado = false,
  variante = 'primario',
}: Props) {
  const { cores } = useTema();
  const bloqueado = desabilitado || carregando;

  if (variante === 'secundario') {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: bloqueado }}
        onPress={aoPressionar}
        disabled={bloqueado}
        style={({ pressed }) => [
          styles.base,
          {
            backgroundColor: cores.surfaceElevated,
            borderColor: cores.borderSubtle,
            borderWidth: 1,
            opacity: bloqueado ? 0.55 : pressed ? 0.8 : 1,
          },
        ]}
      >
        <Text style={[styles.texto, { color: cores.textPrimary }]}>{titulo}</Text>
      </Pressable>
    );
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: bloqueado }}
      onPress={aoPressionar}
      disabled={bloqueado}
      style={({ pressed }) => [styles.base, { opacity: bloqueado ? 0.55 : pressed ? 0.88 : 1 }]}
    >
      <LinearGradient
        colors={gradiente}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradiente}
      >
        {carregando ? (
          <View style={styles.linha}>
            <ActivityIndicator color="#0A0E18" />
            <Text style={[styles.texto, styles.textoEscuro]}>Enviando...</Text>
          </View>
        ) : (
          <Text style={[styles.texto, styles.textoEscuro]}>{titulo}</Text>
        )}
      </LinearGradient>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: raios.md,
    overflow: 'hidden',
    minHeight: 52,
    justifyContent: 'center',
  },
  gradiente: {
    flex: 1,
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: espacos.lg,
  },
  linha: { flexDirection: 'row', alignItems: 'center', gap: espacos.sm },
  texto: {
    fontFamily: fontes.semiBold,
    fontSize: 16,
    textAlign: 'center',
  },
  textoEscuro: { color: '#0A0E18' },
});
