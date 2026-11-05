/**
 * Navegação do GASTIFY.
 *
 * Estrutura:
 *   Stack raiz
 *   ├── Login              (quando não há sessão)
 *   ├── Abas               (quando há sessão)
 *   │   ├── Início         (home com gastos do dia)
 *   │   ├── Dashboard      (gráficos mensal/anual)
 *   │   ├── Filtros        (busca + categorias + período)
 *   │   └── Ajustes        (tema, conta, sobre)
 *   └── NovoGasto          (modal de criação/edição, acessível das abas)
 *
 * A troca Login <-> Abas é reativa ao estado do AuthProvider: login/cadastro
 * mudam `usuario`, logout limpa `usuario`. Nenhuma tela precisa navegar na mão.
 */

import { useCallback } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { NavigationContainer, DefaultTheme, type Theme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
} from '@expo-google-fonts/plus-jakarta-sans';

import { useAuth } from '../auth/AuthProvider';
import { useTema } from '../theme/ThemeProvider';
import { espacos, fontes } from '../theme/tokens';
import type { ParamsAbas, ParamsRaiz } from './tipos';
import { AjustesScreen } from '../screens/AjustesScreen';
import { DashboardScreen } from '../screens/DashboardScreen';
import { FiltrosScreen } from '../screens/FiltrosScreen';
import { HomeScreen } from '../screens/HomeScreen';
import { LoginScreen } from '../screens/LoginScreen';
import { NovoGastoScreen } from '../screens/NovoGastoScreen';

const Stack = createNativeStackNavigator<ParamsRaiz>();
const Abas = createBottomTabNavigator<ParamsAbas>();

/** Ícones das abas: emoji evita mais uma dependência de ícones no bundle. */
const ICONES: Record<keyof ParamsAbas, string> = {
  Inicio: '🏠',
  Dashboard: '📊',
  Filtros: '🔎',
  Ajustes: '⚙️',
};

function NavegacaoAbas() {
  const { cores } = useTema();

  return (
    <Abas.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarHideOnKeyboard: true,
        tabBarActiveTintColor: cores.primary,
        tabBarInactiveTintColor: cores.textSecondary,
        tabBarStyle: {
          backgroundColor: cores.surface,
          borderTopColor: cores.borderSubtle,
          borderTopWidth: StyleSheet.hairlineWidth,
          height: 62,
          paddingBottom: 8,
          paddingTop: 6,
        },
        tabBarLabelStyle: { fontFamily: fontes.medium, fontSize: 10 },
        tabBarIcon: ({ focused }) => (
          <Text style={{ fontSize: 18, opacity: focused ? 1 : 0.55 }}>
            {ICONES[route.name as keyof ParamsAbas]}
          </Text>
        ),
      })}
    >
      <Abas.Screen name="Inicio" component={HomeScreen} options={{ title: 'Início' }} />
      <Abas.Screen name="Dashboard" component={DashboardScreen} options={{ title: 'Dashboard' }} />
      <Abas.Screen name="Filtros" component={FiltrosScreen} options={{ title: 'Filtros' }} />
      <Abas.Screen name="Ajustes" component={AjustesScreen} options={{ title: 'Ajustes' }} />
    </Abas.Navigator>
  );
}

/** Tela de carregamento enquanto fontes/sessão são resolvidas. */
function Carregando({ mensagem }: { mensagem: string }) {
  const { cores } = useTema();
  return (
    <View style={[styles.carregando, { backgroundColor: cores.background }]}>
      <Text style={[styles.marca, { color: cores.primary }]}>GASTIFY</Text>
      <ActivityIndicator color={cores.primary} />
      <Text style={[styles.carregandoTexto, { color: cores.textSecondary }]}>{mensagem}</Text>
    </View>
  );
}

export function AppNavigator() {
  const { cores, esquema } = useTema();
  const { usuario, carregando } = useAuth();

  // Fontes do design system. Enquanto não chegam, usamos a tela de loading —
  // evita o "pulo" de layout quando a fonte troca.
  const [fontesProntas] = useFonts({
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
  });

  const temaNavegacao: Theme = {
    ...DefaultTheme,
    dark: esquema === 'escuro',
    colors: {
      primary: cores.primary,
      background: cores.background,
      card: cores.surface,
      text: cores.textPrimary,
      border: cores.borderSubtle,
      notification: cores.accent,
    },
  };

  const montarAbas = useCallback(() => <NavegacaoAbas />, []);

  if (!fontesProntas || carregando) {
    return <Carregando mensagem={fontesProntas ? 'Abrindo sua sessão...' : 'Preparando o app...'} />;
  }

  return (
    <NavigationContainer theme={temaNavegacao}>
      <StatusBar style={esquema === 'escuro' ? 'light' : 'dark'} />
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {usuario ? (
          <>
            <Stack.Screen name="Abas" options={{ animation: 'fade' }}>
              {montarAbas}
            </Stack.Screen>
            <Stack.Screen
              name="NovoGasto"
              component={NovoGastoScreen}
              options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
            />
          </>
        ) : (
          <Stack.Screen name="Login" component={LoginScreen} options={{ animation: 'fade' }} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  carregando: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: espacos.md },
  marca: { fontFamily: fontes.bold, fontSize: 22, letterSpacing: 5 },
  carregandoTexto: { fontFamily: fontes.regular, fontSize: 12 },
});
