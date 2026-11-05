/**
 * Tela de criação/edição de gasto.
 *
 * A mesma tela serve para os dois fluxos (route.params.gasto define o modo),
 * o que evita duplicar formulário e regras de validação.
 *
 * Cuidados:
 *  * valor é digitado em formato brasileiro e convertido com `parseValor`;
 *  * data usa máscara DD/MM/AAAA e é validada (inclusive contra data futura);
 *  * o botão de excluir só aparece na edição, com confirmação.
 */

import { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { ErroApi } from '../api/client';
import { atualizarGasto, criarGasto, removerGasto } from '../api/gastos';
import { Botao } from '../components/Botao';
import { CampoTexto } from '../components/CampoTexto';
import { CategoriaChip } from '../components/CategoriaChip';
import { Tela } from '../components/Tela';
import type { ParamsRaiz } from '../navigation/tipos';
import { useTema } from '../theme/ThemeProvider';
import { categorias, espacos, fontes, gradiente, raios } from '../theme/tokens';
import {
  deDataBRparaISO,
  formatarEntradaValor,
  hojeISO,
  mascararData,
  paraDataBR,
  parseValor,
} from '../utils/formato';

type Props = NativeStackScreenProps<ParamsRaiz, 'NovoGasto'>;

export function NovoGastoScreen({ route, navigation }: Props) {
  const { cores } = useTema();
  const gastoExistente = route.params?.gasto;
  const editando = Boolean(gastoExistente);

  const [nome, setNome] = useState(gastoExistente?.nome ?? '');
  const [valor, setValor] = useState(
    gastoExistente
      ? formatarEntradaValor(gastoExistente.valor.toFixed(2).replace('.', ','))
      : '',
  );
  const [data, setData] = useState(
    gastoExistente ? paraDataBR(gastoExistente.data) : paraDataBR(hojeISO()),
  );
  const [categoria, setCategoria] = useState<string>(gastoExistente?.categoria ?? 'alimentacao');

  const [erros, setErros] = useState<Record<string, string>>({});
  const [erroGeral, setErroGeral] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  function validar(): { iso: string; numero: number } | null {
    const novos: Record<string, string> = {};

    if (nome.trim().length === 0) {
      novos.nome = 'Dê um nome para o gasto.';
    }

    const numero = parseValor(valor);
    if (numero === null) {
      novos.valor = 'Informe um valor maior que zero (ex.: 19,90).';
    }

    const iso = deDataBRparaISO(data);
    if (!iso) {
      novos.data = 'Data inválida. Use o formato DD/MM/AAAA.';
    } else if (iso > hojeISO()) {
      novos.data = 'A data não pode ser no futuro.';
    }

    setErros(novos);
    if (Object.keys(novos).length > 0 || numero === null || !iso) return null;

    return { iso, numero };
  }

  async function salvar() {
    if (salvando) return;
    const validado = validar();
    if (!validado) return;

    setSalvando(true);
    setErroGeral(null);

    const dados = {
      nome: nome.trim(),
      valor: validado.numero,
      data: validado.iso,
      categoria: categoria as (typeof categorias)[number]['slug'],
    };

    try {
      if (gastoExistente) {
        await atualizarGasto(gastoExistente.id, dados);
      } else {
        await criarGasto(dados);
      }
      navigation.goBack();
    } catch (falha) {
      if (falha instanceof ErroApi) {
        if (falha.detalhes.length > 0) {
          const porCampo: Record<string, string> = {};
          for (const detalhe of falha.detalhes) porCampo[detalhe.campo] = detalhe.mensagem;
          setErros(porCampo);
        }
        setErroGeral(falha.mensagemAmigavel);
      } else {
        setErroGeral('Não foi possível salvar o gasto. Tente novamente.');
      }
    } finally {
      setSalvando(false);
    }
  }

  function confirmarExclusao() {
    if (!gastoExistente) return;

    Alert.alert('Excluir gasto', `Deseja realmente excluir "${gastoExistente.nome}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Excluir',
        style: 'destructive',
        onPress: async () => {
          try {
            await removerGasto(gastoExistente.id);
            navigation.goBack();
          } catch (falha) {
            setErroGeral(
              falha instanceof ErroApi
                ? falha.mensagemAmigavel
                : 'Não foi possível excluir o gasto.',
            );
          }
        },
      },
    ]);
  }

  return (
    <Tela comPadding={false}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.conteudo}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <LinearGradient
            colors={gradiente}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.cabecalho}
          >
            <Text style={styles.cabecalhoRotulo}>{editando ? 'Editar gasto' : 'Novo gasto'}</Text>
            <Text style={styles.cabecalhoTitulo}>
              {editando ? gastoExistente?.nome : 'Registre seu gasto'}
            </Text>
          </LinearGradient>

          <View style={styles.formulario}>
            <CampoTexto
              label="Nome"
              placeholder="Ex.: Almoço, Uber, Farmácia"
              value={nome}
              onChangeText={setNome}
              erro={erros.nome}
              maxLength={120}
              autoCapitalize="sentences"
            />

            <CampoTexto
              label="Valor (R$)"
              placeholder="0,00"
              value={valor}
              onChangeText={(texto) => setValor(formatarEntradaValor(texto))}
              erro={erros.valor}
              keyboardType="decimal-pad"
              maxLength={15}
            />

            <CampoTexto
              label="Data"
              placeholder="DD/MM/AAAA"
              value={data}
              onChangeText={(texto) => setData(mascararData(texto))}
              erro={erros.data}
              keyboardType="number-pad"
              maxLength={10}
            />

            <Text style={[styles.labelCategoria, { color: cores.textSecondary }]}>Categoria</Text>
            <View style={styles.chips}>
              {categorias.map((item) => (
                <CategoriaChip
                  key={item.slug}
                  categoria={item.slug}
                  selecionada={categoria === item.slug}
                  aoPressionar={setCategoria}
                />
              ))}
            </View>

            {erroGeral ? (
              <View style={[styles.alerta, { backgroundColor: `${cores.danger}1A`, borderColor: cores.danger }]}>
                <Text style={[styles.alertaTexto, { color: cores.danger }]}>{erroGeral}</Text>
              </View>
            ) : null}

            <Botao
              titulo={editando ? 'Salvar alterações' : 'Adicionar gasto'}
              aoPressionar={salvar}
              carregando={salvando}
            />

            {editando ? (
              <Pressable
                accessibilityRole="button"
                onPress={confirmarExclusao}
                style={({ pressed }) => [
                  styles.excluir,
                  { borderColor: cores.danger, opacity: pressed ? 0.7 : 1 },
                ]}
              >
                <Text style={[styles.excluirTexto, { color: cores.danger }]}>Excluir gasto</Text>
              </Pressable>
            ) : null}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Tela>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  conteudo: { paddingBottom: espacos.xl },
  cabecalho: {
    paddingHorizontal: espacos.xl,
    paddingVertical: espacos.xl,
    borderBottomLeftRadius: raios.xl,
    borderBottomRightRadius: raios.xl,
    marginBottom: espacos.lg,
  },
  cabecalhoRotulo: {
    fontFamily: fontes.medium,
    fontSize: 11,
    color: 'rgba(10, 14, 24, 0.72)',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  cabecalhoTitulo: { fontFamily: fontes.bold, fontSize: 22, color: '#0A0E18', marginTop: espacos.xs },
  formulario: { paddingHorizontal: espacos.lg },
  labelCategoria: {
    fontFamily: fontes.medium,
    fontSize: 12,
    marginBottom: espacos.sm,
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: espacos.lg },
  alerta: {
    borderWidth: 1,
    borderRadius: raios.sm,
    padding: espacos.md,
    marginBottom: espacos.md,
  },
  alertaTexto: { fontFamily: fontes.medium, fontSize: 13, lineHeight: 19 },
  excluir: {
    marginTop: espacos.lg,
    borderWidth: 1,
    borderRadius: raios.md,
    paddingVertical: espacos.md,
    alignItems: 'center',
  },
  excluirTexto: { fontFamily: fontes.semiBold, fontSize: 14 },
});
