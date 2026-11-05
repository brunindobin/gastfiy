/**
 * Dashboard de análise.
 *
 * Consome as agregações do backend (mensal/anual) — nenhuma soma é feita no
 * app, o que mantém a tela fluida. Duas visões:
 *  * Mensal: barras por dia do mês + rosca por categoria;
 *  * Anual: barras por mês + rosca por categoria.
 *
 * O usuário só navega até o período atual (não faz sentido ver o futuro).
 */

import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

import { ErroApi } from '../api/client';
import { buscarAnual, buscarMensal } from '../api/agregacoes';
import type { AgregacaoAnual, AgregacaoMensal } from '../api/types';
import { EmptyState } from '../components/EmptyState';
import { GraficoBarras, GraficoDonut } from '../components/Graficos';
import { Tela } from '../components/Tela';
import { useTema } from '../theme/ThemeProvider';
import { dadosCategoria, espacos, fontes, raios } from '../theme/tokens';
import { formatarMoeda } from '../utils/formato';

type Visao = 'mensal' | 'anual';

const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];
const MESES_CURTOS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

export function DashboardScreen() {
  const { cores } = useTema();
  const hoje = new Date();

  const [visao, setVisao] = useState<Visao>('mensal');
  const [ano, setAno] = useState(hoje.getFullYear());
  const [mes, setMes] = useState(hoje.getMonth() + 1);

  const [mensal, setMensal] = useState<AgregacaoMensal | null>(null);
  const [anual, setAnual] = useState<AgregacaoAnual | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [atualizando, setAtualizando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(
    async (modo: 'inicial' | 'refresh' = 'inicial') => {
      if (modo === 'refresh') setAtualizando(true);
      else setCarregando(true);

      try {
        if (visao === 'mensal') {
          setMensal(await buscarMensal(ano, mes));
        } else {
          setAnual(await buscarAnual(ano));
        }
        setErro(null);
      } catch (falha) {
        if (falha instanceof ErroApi && falha.status === 401) return;
        setErro(
          falha instanceof ErroApi ? falha.mensagemAmigavel : 'Não foi possível carregar o resumo.',
        );
      } finally {
        setCarregando(false);
        setAtualizando(false);
      }
    },
    [visao, ano, mes],
  );

  useFocusEffect(
    useCallback(() => {
      void carregar();
    }, [carregar]),
  );

  /** Navega meses/anos sem permitir período futuro. */
  function mudarPeriodo(delta: number) {
    if (visao === 'mensal') {
      const alvo = new Date(ano, mes - 1 + delta, 1);
      const limite = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
      if (alvo > limite) return;
      setAno(alvo.getFullYear());
      setMes(alvo.getMonth() + 1);
      return;
    }

    const novoAno = ano + delta;
    if (novoAno > hoje.getFullYear()) return;
    setAno(novoAno);
  }

  const periodoAtual = visao === 'mensal' ? `${MESES[mes - 1]} de ${ano}` : String(ano);

  const total = visao === 'mensal' ? mensal?.total ?? 0 : anual?.total ?? 0;
  const quantidade = visao === 'mensal' ? mensal?.quantidade ?? 0 : anual?.quantidade ?? 0;
  const porCategoria = visao === 'mensal' ? mensal?.por_categoria ?? [] : anual?.por_categoria ?? [];

  /** Média por dia (mensal) ou por mês (anual), considerando só o período decorrido. */
  const media = useMemo(() => {
    if (visao === 'mensal') {
      const noMesAtual = ano === hoje.getFullYear() && mes === hoje.getMonth() + 1;
      const dias = noMesAtual ? hoje.getDate() : new Date(ano, mes, 0).getDate();
      return total / Math.max(1, dias);
    }
    const mesesDecorridos = ano === hoje.getFullYear() ? hoje.getMonth() + 1 : 12;
    return total / Math.max(1, mesesDecorridos);
  }, [visao, total, ano, mes, hoje]);

  const barras = useMemo(() => {
    if (visao === 'mensal') {
      return (mensal?.por_dia ?? []).map((item) => ({
        rotulo: String(Number(item.dia.slice(8, 10))),
        valor: item.total,
      }));
    }
    return (anual?.por_mes ?? []).map((item) => ({
      rotulo: MESES_CURTOS[item.mes - 1],
      valor: item.total,
    }));
  }, [visao, mensal, anual]);

  const fatias = useMemo(
    () =>
      porCategoria.map((item) => ({
        rotulo: item.rotulo,
        valor: item.total,
        cor: dadosCategoria(item.categoria).cor,
      })),
    [porCategoria],
  );

  return (
    <Tela comPadding={false}>
      <ScrollView
        contentContainerStyle={styles.conteudo}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={atualizando}
            onRefresh={() => carregar('refresh')}
            tintColor={cores.primary}
            colors={[cores.primary]}
          />
        }
      >
        <Text style={[styles.titulo, { color: cores.textPrimary }]}>Dashboard</Text>
        <Text style={[styles.subtitulo, { color: cores.textSecondary }]}>
          Para onde seu dinheiro está indo?
        </Text>

        {/* Alternância de visão */}
        <View style={[styles.segmentado, { backgroundColor: cores.surfaceElevated }]}>
          {(['mensal', 'anual'] as const).map((valor) => {
            const ativo = visao === valor;
            return (
              <Pressable
                key={valor}
                accessibilityRole="tab"
                accessibilityState={{ selected: ativo }}
                onPress={() => setVisao(valor)}
                style={[
                  styles.segmento,
                  ativo && { backgroundColor: cores.surface, borderColor: cores.borderSubtle },
                ]}
              >
                <Text
                  style={[
                    styles.segmentoTexto,
                    { color: ativo ? cores.textPrimary : cores.textSecondary },
                    ativo && styles.segmentoTextoAtivo,
                  ]}
                >
                  {valor === 'mensal' ? 'Mensal' : 'Anual'}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Navegação de período */}
        <View style={styles.periodo}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Período anterior"
            onPress={() => mudarPeriodo(-1)}
            style={styles.seta}
            hitSlop={8}
          >
            <Text style={[styles.setaTexto, { color: cores.primary }]}>‹</Text>
          </Pressable>
          <Text style={[styles.periodoTexto, { color: cores.textPrimary }]}>{periodoAtual}</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Próximo período"
            onPress={() => mudarPeriodo(1)}
            style={styles.seta}
            hitSlop={8}
          >
            <Text style={[styles.setaTexto, { color: cores.primary }]}>›</Text>
          </Pressable>
        </View>

        {carregando ? (
          <ActivityIndicator style={styles.loading} color={cores.primary} />
        ) : erro ? (
          <Pressable
            onPress={() => carregar()}
            style={[styles.alerta, { backgroundColor: `${cores.danger}1A`, borderColor: cores.danger }]}
          >
            <Text style={[styles.alertaTexto, { color: cores.danger }]}>{erro}</Text>
            <Text style={[styles.alertaAcao, { color: cores.danger }]}>Toque para tentar de novo</Text>
          </Pressable>
        ) : (
          <>
            {/* Resumo */}
            <View style={styles.resumo}>
              <View style={[styles.cardResumo, { backgroundColor: cores.surface, borderColor: cores.borderSubtle }]}>
                <Text style={[styles.cardRotulo, { color: cores.textSecondary }]}>Total</Text>
                <Text style={[styles.cardValor, { color: cores.textPrimary }]}>{formatarMoeda(total)}</Text>
              </View>
              <View style={[styles.cardResumo, { backgroundColor: cores.surface, borderColor: cores.borderSubtle }]}>
                <Text style={[styles.cardRotulo, { color: cores.textSecondary }]}>Lançamentos</Text>
                <Text style={[styles.cardValor, { color: cores.textPrimary }]}>{quantidade}</Text>
              </View>
              <View style={[styles.cardResumo, { backgroundColor: cores.surface, borderColor: cores.borderSubtle }]}>
                <Text style={[styles.cardRotulo, { color: cores.textSecondary }]}>
                  Média/{visao === 'mensal' ? 'dia' : 'mês'}
                </Text>
                <Text style={[styles.cardValor, { color: cores.textPrimary }]}>{formatarMoeda(media)}</Text>
              </View>
            </View>

            {quantidade === 0 ? (
              <EmptyState
                emoji="📊"
                titulo="Sem dados neste período"
                descricao="Registre gastos para ver os gráficos e entender seus hábitos."
              />
            ) : (
              <>
                {/* Barras */}
                <View style={[styles.painel, { backgroundColor: cores.surface, borderColor: cores.borderSubtle }]}>
                  <Text style={[styles.painelTitulo, { color: cores.textPrimary }]}>
                    {visao === 'mensal' ? 'Gastos por dia' : 'Gastos por mês'}
                  </Text>
                  <GraficoBarras dados={barras} cor={cores.primary} />
                </View>

                {/* Rosca por categoria */}
                <View style={[styles.painel, { backgroundColor: cores.surface, borderColor: cores.borderSubtle }]}>
                  <Text style={[styles.painelTitulo, { color: cores.textPrimary }]}>
                    Por categoria
                  </Text>
                  <GraficoDonut dados={fatias} />
                </View>
              </>
            )}
          </>
        )}
      </ScrollView>
    </Tela>
  );
}

const styles = StyleSheet.create({
  conteudo: { paddingHorizontal: espacos.lg, paddingTop: espacos.sm, paddingBottom: espacos.xl },
  titulo: { fontFamily: fontes.bold, fontSize: 22 },
  subtitulo: { fontFamily: fontes.regular, fontSize: 12, marginTop: espacos.xs },
  segmentado: {
    flexDirection: 'row',
    borderRadius: raios.md,
    padding: espacos.xs,
    marginTop: espacos.lg,
  },
  segmento: {
    flex: 1,
    paddingVertical: espacos.sm,
    borderRadius: raios.sm,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  segmentoTexto: { fontFamily: fontes.medium, fontSize: 13 },
  segmentoTextoAtivo: { fontFamily: fontes.semiBold },
  periodo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: espacos.lg,
  },
  seta: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  setaTexto: { fontFamily: fontes.bold, fontSize: 22, lineHeight: 24 },
  periodoTexto: { fontFamily: fontes.semiBold, fontSize: 15 },
  loading: { marginTop: espacos.xxl },
  alerta: {
    borderWidth: 1,
    borderRadius: raios.sm,
    padding: espacos.md,
    marginTop: espacos.lg,
  },
  alertaTexto: { fontFamily: fontes.medium, fontSize: 13 },
  alertaAcao: { fontFamily: fontes.semiBold, fontSize: 12, marginTop: espacos.xs },
  resumo: { flexDirection: 'row', gap: espacos.sm, marginTop: espacos.lg },
  cardResumo: {
    flex: 1,
    borderWidth: 1,
    borderRadius: raios.md,
    padding: espacos.md,
  },
  cardRotulo: { fontFamily: fontes.medium, fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.3 },
  cardValor: { fontFamily: fontes.bold, fontSize: 14, marginTop: espacos.xs },
  painel: {
    borderWidth: 1,
    borderRadius: raios.lg,
    padding: espacos.lg,
    marginTop: espacos.lg,
  },
  painelTitulo: { fontFamily: fontes.semiBold, fontSize: 14, marginBottom: espacos.lg },
});
