/**
 * Tela de entrada: login e criação de conta em abas.
 *
 * Decisões de UX:
 *  * os dois formulários ficam na mesma tela (menos navegação para quem está
 *    começando);
 *  * validação local antes de chamar a API, com mensagem por campo;
 *  * erros do backend (409 e-mail duplicado, 422, 401) são traduzidos para
 *    texto amigável — nunca mostramos o JSON cru.
 */

import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '../auth/AuthProvider';
import { ErroApi } from '../api/client';
import { Botao } from '../components/Botao';
import { CampoTexto } from '../components/CampoTexto';
import { Footer } from '../components/Footer';
import { useTema } from '../theme/ThemeProvider';
import { espacos, fontes, gradiente, raios } from '../theme/tokens';

type Aba = 'entrar' | 'criar';

const EMAIL_VALIDO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function LoginScreen() {
  const { cores } = useTema();
  const { entrar, cadastrar } = useAuth();

  const [aba, setAba] = useState<Aba>('entrar');
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');

  const [erroGeral, setErroGeral] = useState<string | null>(null);
  const [erros, setErros] = useState<Record<string, string>>({});
  const [enviando, setEnviando] = useState(false);

  function trocarAba(nova: Aba) {
    setAba(nova);
    setErroGeral(null);
    setErros({});
  }

  /** Validação local: evita ida ao servidor com dados obviamente inválidos. */
  function validar(): boolean {
    const novos: Record<string, string> = {};

    if (aba === 'criar' && nome.trim().length < 2) {
      novos.nome = 'Informe seu nome.';
    }
    if (!EMAIL_VALIDO.test(email.trim())) {
      novos.email = 'Informe um e-mail válido.';
    }
    if (senha.length < 8) {
      novos.senha = 'A senha precisa ter pelo menos 8 caracteres.';
    }

    setErros(novos);
    return Object.keys(novos).length === 0;
  }

  async function enviar() {
    if (enviando || !validar()) return;

    setEnviando(true);
    setErroGeral(null);
    setErros({});

    try {
      if (aba === 'entrar') {
        await entrar(email, senha);
      } else {
        await cadastrar(nome, email, senha);
      }
      // Navegação é automática: o App observa `usuario` e troca a pilha.
    } catch (erro) {
      if (erro instanceof ErroApi) {
        // 422 traz detalhes por campo — aproveitamos para marcar o input.
        if (erro.detalhes.length > 0) {
          const porCampo: Record<string, string> = {};
          for (const detalhe of erro.detalhes) {
            porCampo[detalhe.campo] = detalhe.mensagem;
          }
          setErros(porCampo);
        }
        setErroGeral(erro.mensagemAmigavel);
      } else {
        setErroGeral('Não foi possível concluir. Tente novamente.');
      }
    } finally {
      setEnviando(false);
    }
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: cores.background }]} edges={['top', 'left', 'right']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.conteudo}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Marca */}
          <View style={styles.marca}>
            <LinearGradient
              colors={gradiente}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.logo}
            >
              <Text style={styles.logoTexto}>G$</Text>
            </LinearGradient>
            <Text style={[styles.titulo, { color: cores.textPrimary }]}>GASTIFY</Text>
            <Text style={[styles.subtitulo, { color: cores.textSecondary }]}>
              Suas finanças, do seu jeito.
            </Text>
          </View>

          {/* Abas */}
          <View style={[styles.abas, { backgroundColor: cores.surfaceElevated }]}>
            {(['entrar', 'criar'] as const).map((valor) => {
              const ativa = aba === valor;
              return (
                <Pressable
                  key={valor}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: ativa }}
                  onPress={() => trocarAba(valor)}
                  style={[
                    styles.aba,
                    ativa && { backgroundColor: cores.surface, borderColor: cores.borderSubtle },
                  ]}
                >
                  <Text
                    style={[
                      styles.abaTexto,
                      { color: ativa ? cores.textPrimary : cores.textSecondary },
                      ativa && styles.abaTextoAtiva,
                    ]}
                  >
                    {valor === 'entrar' ? 'Entrar' : 'Criar conta'}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* Formulário */}
          <View style={styles.formulario}>
            {aba === 'criar' ? (
              <CampoTexto
                label="Nome"
                placeholder="Como podemos te chamar?"
                value={nome}
                onChangeText={setNome}
                erro={erros.nome}
                autoCapitalize="words"
                textContentType="name"
                maxLength={120}
              />
            ) : null}

            <CampoTexto
              label="E-mail"
              placeholder="voce@exemplo.com"
              value={email}
              onChangeText={setEmail}
              erro={erros.email}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              textContentType="emailAddress"
              maxLength={255}
            />

            <CampoTexto
              label="Senha"
              placeholder="Mínimo 8 caracteres"
              value={senha}
              onChangeText={setSenha}
              erro={erros.senha}
              secureTextEntry
              autoCapitalize="none"
              textContentType="password"
              maxLength={72}
              onSubmitEditing={enviar}
              returnKeyType="go"
            />

            {erroGeral ? (
              <View style={[styles.alerta, { backgroundColor: `${cores.danger}1A`, borderColor: cores.danger }]}>
                <Text style={[styles.alertaTexto, { color: cores.danger }]}>{erroGeral}</Text>
              </View>
            ) : null}

            <Botao
              titulo={aba === 'entrar' ? 'Entrar' : 'Criar conta e entrar'}
              aoPressionar={enviar}
              carregando={enviando}
            />

            <Text style={[styles.dica, { color: cores.textSecondary }]}>
              {aba === 'entrar'
                ? 'Ainda não tem conta? Toque em "Criar conta".'
                : 'Ao criar a conta você concorda em manter seus dados seguros.'}
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
      <Footer />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },
  conteudo: {
    flexGrow: 1,
    paddingHorizontal: espacos.xl,
    paddingTop: espacos.xxl,
    paddingBottom: espacos.xl,
    justifyContent: 'center',
  },
  marca: { alignItems: 'center', marginBottom: espacos.xl },
  logo: {
    width: 72,
    height: 72,
    borderRadius: raios.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: espacos.md,
  },
  logoTexto: { fontFamily: fontes.bold, fontSize: 26, color: '#0A0E18' },
  titulo: { fontFamily: fontes.bold, fontSize: 26, letterSpacing: 4 },
  subtitulo: { fontFamily: fontes.regular, fontSize: 13, marginTop: espacos.xs },
  abas: {
    flexDirection: 'row',
    borderRadius: raios.md,
    padding: espacos.xs,
    marginBottom: espacos.xl,
  },
  aba: {
    flex: 1,
    paddingVertical: espacos.sm + 2,
    borderRadius: raios.sm,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  abaTexto: { fontFamily: fontes.medium, fontSize: 14 },
  abaTextoAtiva: { fontFamily: fontes.semiBold },
  formulario: { gap: espacos.xs },
  alerta: {
    borderWidth: 1,
    borderRadius: raios.sm,
    padding: espacos.md,
    marginBottom: espacos.md,
  },
  alertaTexto: { fontFamily: fontes.medium, fontSize: 13, lineHeight: 19 },
  dica: {
    fontFamily: fontes.regular,
    fontSize: 12,
    textAlign: 'center',
    marginTop: espacos.lg,
    lineHeight: 18,
  },
});
