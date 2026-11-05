/**
 * Raiz do app GASTIFY.
 *
 * Ordem dos providers importa:
 *  * `SafeAreaProvider` precisa estar acima de qualquer tela;
 *  * `ThemeProvider` define as cores usadas até pela tela de loading;
 *  * `AuthProvider` usa o cliente HTTP e pode deslogar em qualquer 401;
 *  * `AppNavigator` decide entre Login e as abas conforme a sessão.
 */

import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AuthProvider } from './src/auth/AuthProvider';
import { AppNavigator } from './src/navigation/AppNavigator';
import { ThemeProvider } from './src/theme/ThemeProvider';

export default function App() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AuthProvider>
          <AppNavigator />
        </AuthProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
