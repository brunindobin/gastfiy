/**
 * Tela de filtros e busca.
 *
 * Combina os filtros que o backend suporta (busca por nome, intervalo de datas
 * e múltiplas categorias) com paginação incremental — a lista carrega mais
 * itens ao chegar no fim, sem travar a interface.
 *
 * A validação de datas acontece antes da requisição para dar feedback
 * imediato (o backend também valida, mas o usuário não deve esperar a rede).
 */

import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { ErroApi } from '../api/client';
import { listarGastos } from '../api/gastos';
import type { FiltrosGastos as TipoFiltros, Gasto } from '../api/types';
import { CategoriaChip } from '../components/CategoriaChip';
import { CampoTexto } from '../components/CampoTexto';
import { EmptyState } from '../components/EmptyState';
import { GastoCard } from '../components/GastoCard';
import { Tela } from '../components/Tela';
import type { ParamsRaiz } from '../navigation/tipos';
import { useTema } from '../theme/ThemeProvider';
import { categorias, espacos, fontes, raios } from '../theme/tokens';
import {
  deDataBRparaISO,
  formatarMoeda,
  hojeISO,
  mascararData,
  paraDataBR,
  somarDiasISO,
} from '../utils/formato';

type Navegacao = NativeStackNavigationProp<ParamsRaiz>;

const LIMITE = 20;

export function FiltrosScreen() {
  const { cores } = useTema();
  const navegacao = useNavigation<Navegacao>();

  // Campos do formulário (antes de aplicar).
  const [busca, setBusca] = useState('');
  const [selecionadas, setSelecionadas] = useState<string[]>([]);
  const [inicio, setInicio] = useState('');
  const [fim, setFim] = useState('');
  const [erroFiltro, setErroFiltro] = useState<string | null>(null);

  // Filtros efetivamente aplicados (disparam a consulta).
  const [filtros, setFiltros] = useState<TipoFiltros>({ limite: LIMITE, offset: 0 });

  const [itens, setItens] = useState<Gasto[]>([]);
  const [total, setTotal] = useState(0);
  const [carregando, setCarregando] = useState(true);
  const [carregandoMais, setCarregandoMais] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async (alvo: TipoFiltros, acumular: boolean) => {
    if (acumular) setCarregandoMais(true);
    else setCarregando(true);

    try {
      const resposta = await listarGastos(alvo);
      setTotal(resposta.total);
      setItens((anteriores) => (acumular ? [...anteriores, ...resposta.itens] : resposta.itens));
      setErro(null);
    } catch (falha) {
      if (falha instanceof ErroApi && falha.status === 401) return;
      setErro(
        falha instanceof ErroApi ? falha.mensagemAmigavel : 'Não foi possível carregar os gastos.',
      );
    } finally {
      setCarregando(false);
      setCarregandoMais(false);
    }
  }, []);

  // Toda vez que os filtros aplicados mudam, recomeça da primeira página.
  useEffect(() => {
    void carregar(filtros, false);
  }, [filtros, carregar]);

  function alternarCategoria(slug: string) {
    setSelecionadas((atuais) =>
      atuais.includes(slug) ? atuais.filter((item) => item !== slug) : [...atuais, slug],
    );
  }

  function aplicar() {
    setErroFiltro(null);

    const isoInicio = inicio ? deDataBRparaISO(inicio) : null;
    const isoFim = fim ? deDataBRparaISO(fim) : null;

    if (inicio && !isoInicio) {
      setErroFiltro('Data inicial inválida. Use DD/MM/AAAA.');
      return;
    }
    if (fim && !isoFim) {
      setErroFiltro('Data final inválida. Use DD/MM/AAAA.');
      return;
    }
    if (isoInicio && isoFim && isoInicio > isoFim) {
      setErroFiltro('A data inicial não pode ser posterior à final.');
      return;
    }

    setFiltros({
      busca: busca.trim() || undefined,
      categorias: selecionadas.length > 0 ? (selecionadas as TipoFiltros['categorias']) : undefined,
      data_inicio: isoInicio ?? undefined,
      data_fim: isoFim ?? undefined,
      limite: LIMITE,
      offset: 0,
    });
  }

  function limpar() {
    setBusca('');
    setSelecionadas([]);
    setInicio('');
    setFim('');
    setErroFiltro(null);
    setFiltros({ limite: LIMITE, offset: 0 });
  }

  /** Atalhos de período: preenchem as datas e já aplicam. */
  function usarPeriodo(dias: number | 'mes') {
    const hoje = hojeISO();
    if (dias === 'mes') {
      setInicio(paraDataBR(`${hoje.slice(0, 8)}01`));
      setFim(paraDataBR(hoje));
      return;
    }
    setInicio(paraDataBR(somarDiasISO(hoje, -(dias - 1))));
    setFim(paraDataBR(hoje));
  }

  function carregarMais() {
    if (carregando || carregandoMais || itens.length >= total) return;
    void carregar({ ...filtros, offset: itens.length }, true);
  }

  const totalFiltrado = itens.reduce((soma, item) => soma + item.valor, 0);

  const cabecalho = (
    <View>
      <Text style={[styles.titulo, { color: cores.textPrimary }]}>Filtros</Text>
      <Text style={[styles.subtitulo, { color: cores.textSecondary }]}>
        Encontre qualquer gasto por nome, data ou categoria.
      </Text>

      {/* Busca */}
      <View style={[styles.busca, { backgroundColor: cores.input, borderColor: cores.borderSubtle }]}>
        <Text style={styles.lupa}>🔍</Text>
        <TextInput
          value={busca}
          onChangeText={setBusca}
          placeholder="Buscar por nome..."
          placeholderTextColor={cores.textSecondary}
          style={[styles.buscaInput, { color: cores.textPrimary }]}
          returnKeyType="search"
          onSubmitEditing={aplicar}
          maxLength={120}
          autoCorrect={false}
        />
        {busca.length > 0 ? (
          <Pressable onPress={() => setBusca('')} hitSlop={8}>
            <Text style={[styles.limparBusca, { color: cores.textSecondary }]}>✕</Text>
          </Pressable>
        ) : null}
      </View>

      {/* Categorias */}
      <Text style={[styles.label, { color: cores.textSecondary }]}>Categorias</Text>
      <View style={styles.chips}>
        {categorias.map((item) => (
          <CategoriaChip
            key={item.slug}
            categoria={item.slug}
            selecionada={selecionadas.includes(item.slug)}
            aoPressionar={alternarCategoria}
          />
        ))}
      </View>

      {/* Datas */}
      <Text style={[styles.label, { color: cores.textSecondary }]}>Período</Text>
      <View style={styles.linhaDatas}>
        <View style={styles.campoData}>
          <CampoTexto
            label="De"
            placeholder="DD/MM/AAAA"
            value={inicio}
            onChangeText={(texto) => setInicio(mascararData(texto))}
            keyboardType="number-pad"
            maxLength={10}
          />
        </View>
        <View style={styles.campoData}>
          <CampoTexto
            label="Até"
            placeholder="DD/MM/AAAA"
            value={fim}
            onChangeText={(texto) => setFim(mascararData(texto))}
            keyboardType="number-pad"
            maxLength={10}
          />
        </View>
      </View>

      <View style={styles.atalhos}>
        {[
          { rotulo: 'Hoje', dias: 1 as const },
          { rotulo: '7 dias', dias: 7 as const },
          { rotulo: '30 dias', dias: 30 as const },
          { rotulo: 'Este mês', dias: 'mes' as const },
        ].map((atalho) => (
          <Pressable
            key={atalho.rotulo}
            onPress={() => usarPeriodo(atalho.dias)}
            style={({ pressed }) => [
              styles.atalho,
              { borderColor: cores.borderSubtle, opacity: pressed ? 0.7 : 1 },
            ]}
          >
            <Text style={[styles.atalhoTexto, { color: cores.textSecondary }]}>{atalho.rotulo}</Text>
          </Pressable>
        ))}
      </View>

      {erroFiltro ? (
        <Text style={[styles.erroFiltro, { color: cores.danger }]}>{erroFiltro}</Text>
      ) : null}

      <View style={styles.acoes}>
        <Pressable
          accessibilityRole="button"
          onPress={aplicar}
          style={({ pressed }) => [
            styles.aplicar,
            { backgroundColor: cores.primary, opacity: pressed ? 0.85 : 1 },
          ]}
        >
          <Text style={styles.aplicarTexto}>Aplicar filtros</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={limpar}
          style={({ pressed }) => [
            styles.limpar,
            { borderColor: cores.borderSubtle, opacity: pressed ? 0.7 : 1 },
          ]}
        >
          <Text style={[styles.limparTexto, { color: cores.textSecondary }]}>Limpar</Text>
        </Pressable>
      </View>

      {/* Resultado */}
      {erro ? (
        <Text style={[styles.erroFiltro, { color: cores.danger }]}>{erro}</Text>
      ) : (
        <View style={styles.resultado}>
          <Text style={[styles.resultadoTexto, { color: cores.textSecondary }]}>
            {total} {total === 1 ? 'resultado' : 'resultados'}
            {total > 0 ? ` · ${formatarMoeda(totalFiltrado)}` : ''}
          </Text>
          {carregando ? <ActivityIndicator size="small" color={cores.primary} /> : null}
        </View>
      )}
    </View>
  );

  return (
    <Tela comPadding={false}>
      <FlatList
        data={itens}
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
              emoji="🔎"
              titulo="Nada encontrado"
              descricao="Tente outra palavra, remova o período ou selecione menos categorias."
              acao={{ rotulo: 'Limpar filtros', aoPressionar: limpar }}
            />
          )
        }
        ListFooterComponent={
          carregandoMais ? (
            <ActivityIndicator style={styles.rodape} color={cores.primary} />
          ) : itens.length > 0 && itens.length >= total ? (
            <Text style={[styles.fim, { color: cores.textSecondary }]}>Fim da lista</Text>
          ) : undefined
        }
        onEndReached={carregarMais}
        onEndReachedThreshold={0.4}
        contentContainerStyle={styles.lista}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      />
    </Tela>
  );
}

const styles = StyleSheet.create({
  lista: { paddingHorizontal: espacos.lg, paddingTop: espacos.sm, paddingBottom: espacos.xl },
  titulo: { fontFamily: fontes.bold, fontSize: 22 },
  subtitulo: { fontFamily: fontes.regular, fontSize: 12, marginTop: espacos.xs },
  busca: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: raios.md,
    paddingHorizontal: espacos.md,
    marginTop: espacos.lg,
    gap: espacos.sm,
  },
  lupa: { fontSize: 14 },
  buscaInput: { flex: 1, fontFamily: fontes.regular, fontSize: 15, paddingVertical: espacos.md },
  limparBusca: { fontFamily: fontes.semiBold, fontSize: 14 },
  label: {
    fontFamily: fontes.medium,
    fontSize: 11,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    marginTop: espacos.lg,
    marginBottom: espacos.sm,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap' },
  linhaDatas: { flexDirection: 'row', gap: espacos.md },
  campoData: { flex: 1 },
  atalhos: { flexDirection: 'row', flexWrap: 'wrap', gap: espacos.sm, marginBottom: espacos.sm },
  atalho: {
    borderWidth: 1,
    borderRadius: raios.pill,
    paddingHorizontal: espacos.md,
    paddingVertical: espacos.xs + 2,
  },
  atalhoTexto: { fontFamily: fontes.medium, fontSize: 12 },
  erroFiltro: { fontFamily: fontes.medium, fontSize: 12, marginBottom: espacos.sm },
  acoes: { flexDirection: 'row', gap: espacos.sm, marginTop: espacos.xs },
  aplicar: {
    flex: 1,
    borderRadius: raios.md,
    paddingVertical: espacos.md,
    alignItems: 'center',
  },
  aplicarTexto: { fontFamily: fontes.semiBold, fontSize: 14, color: '#0A0E18' },
  limpar: {
    borderWidth: 1,
    borderRadius: raios.md,
    paddingVertical: espacos.md,
    paddingHorizontal: espacos.lg,
    alignItems: 'center',
  },
  limparTexto: { fontFamily: fontes.semiBold, fontSize: 14 },
  resultado: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: espacos.lg,
    marginBottom: espacos.md,
  },
  resultadoTexto: { fontFamily: fontes.medium, fontSize: 12 },
  rodape: { paddingVertical: espacos.lg },
  fim: { fontFamily: fontes.regular, fontSize: 11, textAlign: 'center', paddingVertical: espacos.lg },
});
