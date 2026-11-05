/**
 * Armazenamento local com um adaptador por plataforma.
 *
 * Por quê: o token JWT é sensível — no Android ele vai para o `expo-secure-store`
 * (Keystore). No web não existe SecureStore, então cai para AsyncStorage (uso
 * apenas de desenvolvimento). As preferências de tema usam AsyncStorage sempre.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const CHAVE_TOKEN = 'gastify.token';
const CHAVE_USUARIO = 'gastify.usuario';
const CHAVE_TEMA = 'gastify.tema';

export async function salvarToken(token: string): Promise<void> {
  if (Platform.OS === 'web') {
    await AsyncStorage.setItem(CHAVE_TOKEN, token);
    return;
  }
  await SecureStore.setItemAsync(CHAVE_TOKEN, token);
}

export async function lerToken(): Promise<string | null> {
  if (Platform.OS === 'web') return AsyncStorage.getItem(CHAVE_TOKEN);
  return SecureStore.getItemAsync(CHAVE_TOKEN);
}

export async function removerToken(): Promise<void> {
  if (Platform.OS === 'web') {
    await AsyncStorage.removeItem(CHAVE_TOKEN);
    return;
  }
  await SecureStore.deleteItemAsync(CHAVE_TOKEN);
}

export async function salvarUsuario(usuario: unknown): Promise<void> {
  await AsyncStorage.setItem(CHAVE_USUARIO, JSON.stringify(usuario));
}

export async function lerUsuario<T>(): Promise<T | null> {
  const bruto = await AsyncStorage.getItem(CHAVE_USUARIO);
  if (!bruto) return null;
  try {
    return JSON.parse(bruto) as T;
  } catch {
    return null;
  }
}

export async function removerUsuario(): Promise<void> {
  await AsyncStorage.removeItem(CHAVE_USUARIO);
}

export async function salvarTema(modo: string): Promise<void> {
  await AsyncStorage.setItem(CHAVE_TEMA, modo);
}

export async function lerTema(): Promise<string | null> {
  return AsyncStorage.getItem(CHAVE_TEMA);
}
