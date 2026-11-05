/**
 * Ajustes do app: tema, conta e informações.
 *
 * O seletor de tema grava a preferência no AsyncStorage (via ThemeProvider),
 * então a escolha sobrevive ao fechar o app. O logout limpa token e usuário e
 * a navegação volta automaticamente para o login.
 */

import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { useAuth } from '../auth/AuthProvider';
import { Tela } from '../components/Tela';
import { useTema, type ModoTema } from '../theme/ThemeProvider';
import { espacos, fontes, gradiente, raios } from '../theme/tokens';

const VERSAO = '1.0.0';

const OPCOES_TEMA: { modo: ModoTema; rotulo: string; descricao: string; emoji: string }[] = [
  { modo: 'escuro', rotulo: 'Escuro', descricao: 'Confortável à noite', emoji: '🌙' },
  { modo: 'claro', rotulo: 'Claro', descricao: 'Melhor à luz do dia', emoji: '☀️' },
  { modo: 'sistema', rotulo: 'Sistema', descricao: 'Segue o aparelho', emoji: '⚙️' },
];

export function AjustesScreen() {
  const { cores, modo, definirModo } = useTema();
  const { usuario, sair } = useAuth();

  function confirmarSaida() {
    Alert.alert('Sair da conta', 'Você precisará entrar novamente para ver seus gastos.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Sair', style: 'destructive', onPress: () => void sair() },
    ]);
  }

  const inicial = usuario?.nome?.trim().charAt(0).toUpperCase() ?? '?';

  return (
    <Tela comPadding={false}>
      <ScrollView contentContainerStyle={styles.conteudo} showsVerticalScrollIndicator={false}>
        <Text style={[styles.titulo, { color: cores.textPrimary }]}>Ajustes</Text>
        <Text style={[styles.subtitulo, { color: cores.textSecondary }]}>
          Personalize o app e gerencie sua conta.
        </Text>

        {/* Conta */}
        <View style={[styles.card, { backgroundColor: cores.surface, borderColor: cores.borderSubtle }]}>
          <LinearGradient
            colors={gradiente}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.avatar}
          >
            <Text style={styles.avatarTexto}>{inicial}</Text>
          </LinearGradient>
          <View style={styles.contaInfo}>
            <Text style={[styles.contaNome, { color: cores.textPrimary }]} numberOfLines={1}>
              {usuario?.nome ?? 'Usuário'}
            </Text>
            <Text style={[styles.contaEmail, { color: cores.textSecondary }]} numberOfLines={1}>
              {usuario?.email ?? '—'}
            </Text>
          </View>
        </View>

        {/* Tema */}
        <Text style={[styles.secao, { color: cores.textSecondary }]}>Aparência</Text>
        <View style={styles.opcoesTema}>
          {OPCOES_TEMA.map((opcao) => {
            const ativa = modo === opcao.modo;
            return (
              <Pressable
                key={opcao.modo}
                accessibilityRole="radio"
                accessibilityState={{ selected: ativa }}
                onPress={() => void definirModo(opcao.modo)}
                style={({ pressed }) => [
                  styles.opcaoTema,
                  {
                    backgroundColor: cores.surface,
                    borderColor: ativa ? cores.primary : cores.borderSubtle,
                    borderWidth: ativa ? 2 : 1,
                    opacity: pressed ? 0.8 : 1,
                  },
                ]}
              >
                <Text style={styles.opcaoEmoji}>{opcao.emoji}</Text>
                <Text style={[styles.opcaoRotulo, { color: cores.textPrimary }]}>{opcao.rotulo}</Text>
                <Text style={[styles.opcaoDescricao, { color: cores.textSecondary }]}>
                  {opcao.descricao}
                </Text>
                {ativa ? (
                  <Text style={[styles.marcador, { color: cores.primary }]}>✓</Text>
                ) : null}
              </Pressable>
            );
          })}
        </View>

        {/* Sobre */}
        <Text style={[styles.secao, { color: cores.textSecondary }]}>Sobre</Text>
        <View style={[styles.cardSobre, { backgroundColor: cores.surface, borderColor: cores.borderSubtle }]}>
          <View style={styles.linhaSobre}>
            <Text style={[styles.sobreChave, { color: cores.textSecondary }]}>Versão</Text>
            <Text style={[styles.sobreValor, { color: cores.textPrimary }]}>{VERSAO}</Text>
          </View>
          <View style={[styles.divisor, { backgroundColor: cores.borderSubtle }]} />
          <View style={styles.linhaSobre}>
            <Text style={[styles.sobreChave, { color: cores.textSecondary }]}>Backend</Text>
            <Text style={[styles.sobreValor, { color: cores.textPrimary }]}>FastAPI + PostgreSQL</Text>
          </View>
          <View style={[styles.divisor, { backgroundColor: cores.borderSubtle }]} />
          <View style={styles.linhaSobre}>
            <Text style={[styles.sobreChave, { color: cores.textSecondary }]}>Backup</Text>
            <Text style={[styles.sobreValor, { color: cores.textPrimary }]}>MongoDB (espelho)</Text>
          </View>
          <View style={[styles.divisor, { backgroundColor: cores.borderSubtle }]} />
          <View style={styles.linhaSobre}>
            <Text style={[styles.sobreChave, { color: cores.textSecondary }]}>Desenvolvido por</Text>
            <Text style={[styles.sobreValor, { color: cores.primary }]}>Bruno Merullo</Text>
          </View>
        </View>

        {/* Logout */}
        <Pressable
          accessibilityRole="button"
          onPress={confirmarSaida}
          style={({ pressed }) => [
            styles.sair,
            { borderColor: cores.danger, opacity: pressed ? 0.7 : 1 },
          ]}
        >
          <Text style={[styles.sairTexto, { color: cores.danger }]}>Sair da conta</Text>
        </Pressable>

        <Text style={[styles.assinatura, { color: cores.textSecondary }]}>
          GASTIFY · feito com cuidado para suas finanças
        </Text>
      </ScrollView>
    </Tela>
  );
}

const styles = StyleSheet.create({
  conteudo: { paddingHorizontal: espacos.lg, paddingTop: espacos.sm, paddingBottom: espacos.xl },
  titulo: { fontFamily: fontes.bold, fontSize: 22 },
  subtitulo: { fontFamily: fontes.regular, fontSize: 12, marginTop: espacos.xs },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacos.md,
    borderWidth: 1,
    borderRadius: raios.lg,
    padding: espacos.lg,
    marginTop: espacos.lg,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: raios.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarTexto: { fontFamily: fontes.bold, fontSize: 22, color: '#0A0E18' },
  contaInfo: { flex: 1 },
  contaNome: { fontFamily: fontes.semiBold, fontSize: 16 },
  contaEmail: { fontFamily: fontes.regular, fontSize: 12, marginTop: 2 },
  secao: {
    fontFamily: fontes.medium,
    fontSize: 11,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginTop: espacos.xl,
    marginBottom: espacos.sm,
  },
  opcoesTema: { flexDirection: 'row', gap: espacos.sm },
  opcaoTema: {
    flex: 1,
    borderRadius: raios.md,
    padding: espacos.md,
    minHeight: 104,
  },
  opcaoEmoji: { fontSize: 18 },
  opcaoRotulo: { fontFamily: fontes.semiBold, fontSize: 13, marginTop: espacos.sm },
  opcaoDescricao: { fontFamily: fontes.regular, fontSize: 10, marginTop: 2, lineHeight: 14 },
  marcador: { position: 'absolute', top: espacos.sm, right: espacos.sm, fontFamily: fontes.bold, fontSize: 12 },
  cardSobre: { borderWidth: 1, borderRadius: raios.lg, paddingHorizontal: espacos.lg },
  linhaSobre: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: espacos.md,
    gap: espacos.sm,
  },
  sobreChave: { fontFamily: fontes.regular, fontSize: 12 },
  sobreValor: { fontFamily: fontes.medium, fontSize: 12, flexShrink: 1, textAlign: 'right' },
  divisor: { height: StyleSheet.hairlineWidth },
  sair: {
    marginTop: espacos.xl,
    borderWidth: 1,
    borderRadius: raios.md,
    paddingVertical: espacos.md,
    alignItems: 'center',
  },
  sairTexto: { fontFamily: fontes.semiBold, fontSize: 14 },
  assinatura: {
    fontFamily: fontes.regular,
    fontSize: 11,
    textAlign: 'center',
    marginTop: espacos.xl,
  },
});
