/**
 * Campo de texto padronizado (label + input + mensagem de erro).
 *
 * Um componente só para todos os formulários garante a mesma altura, foco e
 * mensagem de erro — e concentra o estilo do tema em um lugar.
 */

import { useState } from 'react';
import { StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';

import { useTema } from '../theme/ThemeProvider';
import { espacos, fontes, raios } from '../theme/tokens';

type Props = TextInputProps & {
  label: string;
  erro?: string | null;
};

export function CampoTexto({ label, erro, style, onFocus, onBlur, ...resto }: Props) {
  const { cores } = useTema();
  const [focado, setFocado] = useState(false);

  const corBorda = erro ? cores.danger : focado ? cores.primary : cores.borderSubtle;

  return (
    <View style={styles.container}>
      <Text style={[styles.label, { color: cores.textSecondary }]}>{label}</Text>
      <TextInput
        placeholderTextColor={cores.textSecondary}
        style={[
          styles.input,
          {
            backgroundColor: cores.input,
            color: cores.textPrimary,
            borderColor: corBorda,
          },
          style,
        ]}
        onFocus={(evento) => {
          setFocado(true);
          onFocus?.(evento);
        }}
        onBlur={(evento) => {
          setFocado(false);
          onBlur?.(evento);
        }}
        {...resto}
      />
      {erro ? <Text style={[styles.erro, { color: cores.danger }]}>{erro}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: espacos.lg },
  label: {
    fontFamily: fontes.medium,
    fontSize: 12,
    marginBottom: espacos.sm,
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  input: {
    fontFamily: fontes.regular,
    fontSize: 16,
    borderWidth: 1,
    borderRadius: raios.md,
    paddingHorizontal: espacos.lg,
    paddingVertical: espacos.md + 2,
    minHeight: 52,
  },
  erro: {
    fontFamily: fontes.medium,
    fontSize: 12,
    marginTop: espacos.xs,
  },
});
