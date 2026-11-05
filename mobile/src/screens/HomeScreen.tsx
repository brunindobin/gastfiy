/**
 * Tela inicial do GASTIFY.
 *
 * Requisitos do produto atendidos aqui:
 *  * saudação dinâmica (Bom dia/Boa tarde/Boa noite) + nome do usuário;
 *  * data e horário atuais, atualizados a cada minuto;
 *  * lista APENAS dos gastos do dia selecionado;
 *  * seletor para navegar por dias anteriores (sem permitir futuro);
 *  * total do dia em destaque, pull-to-refresh e FAB para novo gasto.
 *
 * Performance: `FlatList` (virtualizada) + `GastoCard` memoizado + recarga
 * apenas quando a tela ganha foco ou o dia muda.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { useAuth } from '../auth/AuthProvider';
import { ErroApi } from '../api/client';
import { listarGastos } from '../api/gastos';
import type { Gasto } from '../api/types';
import { EmptyState } from '../components/EmptyState';
import { GastoCard } from '../components/GastoCard';
import { SeletorDia } from '../components/SeletorDia';
import { Tela } from '../components/Tela';
import type { ParamsRaiz } from '../navigation/tipos';
import { useTema } from '../theme/ThemeProvider';
import { espacos, fontes, gradiente, raios } from '../theme/tokens';
import {
  formatarDataPorExtenso,
  formatarHora,
  formatarMoeda,
  hojeISO,
  saudacao,
} from '../utils/formato';

type Navegacao = NativeStackNavigationProp<ParamsRaiz>;

export function HomeScreen() {
  const { cores } = useTema();
  const { usuario } = useAuth();
  const navegacao = useNavigation<Navegacao>();

  const [dia, setDia] = useState(hojeISO());
  const [gastos, setGastos] = useState<Gasto[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [atualizando, setAtualizando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [agora, setAgora] = useState(new Date());

  // Relógio da saudação: um timer por minuto é suficiente e barato.
  useEffect(() => {
    const timer = setInterval(() => setAgora(new Date()), 60_000);
    return () => clearInterval(timer);
  }, []);

  const carregar = useCallback(async (diaAlvo: string, modo: 'inicial' | 'refresh' = 'inicial') => {
    if (modo === 'refresh') setAtualizando(true);
    else setCarregando(true);

    try {
      const resposta = await listarGastos({ data: diaAlvo, limite: 200 });
      setGastos(resposta.itens);
      setErro(null);
    } catch (falha) {
      // 401 já limpa a sessão no cliente; aqui só mostramos o resto.
      if (falha instanceof ErroApi && falha.status === 401) return;
      setErro(
        falha instanceof ErroApi
          ? falha.mensagemAmigavel
          : 'Não foi possível carregar seus gastos.',
      );
    } finally {
      setCarregando(false);
      setAtualizando(false);
    }
  }, []);

  // Recarrega ao abrir/voltar para a tela e sempre que o dia muda.
  useFocusEffect(
    useCallback(() => {
      void carregar(dia);
    }, [carregar, dia]),
  );

  const totalDoDia = useMemo(
    () => gastos.reduce((soma, gasto) => soma + gasto.valor, 0),
    [gastos],
  );

  const primeiroNome = usuario?.nome?.split(' ')[0] ?? 'visitante';

  const cabecalho = (
    <View>
      {/* Saudação + data/hora */}
      <View style={styles.saudacaoBloco}>
        <Text style={[styles.saudacao, { color: cores.textPrimary }]}>
          {saudacao(agora)}, {primeiroNome}!
        </Text>
        <Text style={[styles.dataHora, { color: cores.textSecondary }]}>
          {formatarDataPorExtenso(hojeISO())} · {formatarHora(agora)}
        </Text>
      </View>

      <SeletorDia data={dia} aoMudar={setDia} />

      {/* Total do dia */}
      <LinearGradient
        colors={gradiente}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.cardTotal}
      >
        <Text style={styles.cardRotulo}>Total do dia</Text>
        <Text style={styles.cardValor}>{formatarMoeda(totalDoDia)}</Text>
        <Text style={styles.cardDetalhe}>
          {gastos.length === 0
            ? 'Nenhum gasto registrado'
            : `${gastos.length} ${gastos.length === 1 ? 'gasto' : 'gastos'}`}
        </Text>
      </LinearGradient>

      <View style={styles.tituloLinha}>
        <Text style={[styles.secao, { color: cores.textPrimary }]}>
          {dia === hojeISO() ? 'Gastos de hoje' : 'Gastos do dia'}
        </Text>
        {carregando ? <ActivityIndicator size="small" color={cores.primary} /> : null}
      </View>

      {erro ? (
        <Pressable
          onPress={() => carregar(dia)}
          style={[styles.alerta, { backgroundColor: `${cores.danger}1A`, borderColor: cores.danger }]}
        >
          <Text style={[styles.alertaTexto, { color: cores.danger }]}>{erro}</Text>
          <Text style={[styles.alertaAcao, { color: cores.danger }]}>Toque para tentar de novo</Text>
        </Pressable>
      ) : null}
    </View>
  );

  return (
    <Tela comPadding={false}>
      <FlatList
        data={gastos}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <GastoCard
            gasto={item}
            aoPressionar={(gasto) => navegacao.navigate('NovoGasto', { gasto })}
          />
        )}
        ListHeaderComponent={cabecalho}
        ListEmptyComponent={
          carregando ? undefined : (
            <EmptyState
              emoji="💸"
              titulo="Nenhum gasto neste dia"
              descricao="Que tal começar registrando o primeiro gasto? Leva menos de 10 segundos."
              acao={{ rotulo: 'Adicionar gasto', aoPressionar: () => navegacao.navigate('NovoGasto') }}
            />
          )
        }
        contentContainerStyle={styles.lista}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={atualizando}
            onRefresh={() => carregar(dia, 'refresh')}
            tintColor={cores.primary}
            colors={[cores.primary]}
          />
        }
      />

      {/* FAB de novo gasto */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Novo gasto"
        onPress={() => navegacao.navigate('NovoGasto')}
        style={({ pressed }) => [styles.fab, { opacity: pressed ? 0.85 : 1 }]}
      >
        <LinearGradient
          colors={gradiente}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.fabGradiente}
        >
          <Text style={styles.fabTexto}>+</Text>
        </LinearGradient>
      </Pressable>
    </Tela>
  );
}

const styles = StyleSheet.create({
  lista: {
    paddingHorizontal: espacos.lg,
    paddingTop: espacos.sm,
    paddingBottom: 96,
  },
  saudacaoBloco: { marginBottom: espacos.lg },
  saudacao: { fontFamily: fontes.bold, fontSize: 22 },
  dataHora: { fontFamily: fontes.regular, fontSize: 12, marginTop: espacos.xs },
  cardTotal: {
    borderRadius: raios.lg,
    padding: espacos.lg,
    marginTop: espacos.lg,
    marginBottom: espacos.lg,
  },
  cardRotulo: {
    fontFamily: fontes.medium,
    fontSize: 12,
    color: 'rgba(10, 14, 24, 0.72)',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  cardValor: { fontFamily: fontes.bold, fontSize: 30, color: '#0A0E18', marginTop: espacos.xs },
  cardDetalhe: { fontFamily: fontes.medium, fontSize: 12, color: 'rgba(10, 14, 24, 0.72)', marginTop: espacos.xs },
  tituloLinha: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: espacos.md,
  },
  secao: { fontFamily: fontes.semiBold, fontSize: 15 },
  alerta: {
    borderWidth: 1,
    borderRadius: raios.sm,
    padding: espacos.md,
    marginBottom: espacos.md,
  },
  alertaTexto: { fontFamily: fontes.medium, fontSize: 13 },
  alertaAcao: { fontFamily: fontes.semiBold, fontSize: 12, marginTop: espacos.xs },
  fab: {
    position: 'absolute',
    right: espacos.lg,
    bottom: espacos.lg,
    borderRadius: raios.pill,
    overflow: 'hidden',
    elevation: 6,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  fabGradiente: { width: 58, height: 58, alignItems: 'center', justifyContent: 'center' },
  fabTexto: { fontFamily: fontes.regular, fontSize: 30, color: '#0A0E18', lineHeight: 32 },
});
