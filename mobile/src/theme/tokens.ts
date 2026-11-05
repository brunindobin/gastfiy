/**
 * Tokens do design system "Obsidian Lumina" (docs/design/tokens.json).
 *
 * Por que um arquivo só de tokens: nenhuma tela deve ter cor hardcoded. Se o
 * designer mudar o cyan, muda aqui e o app inteiro acompanha. O tema claro usa
 * uma paleta neutra derivada (o design oficial do light ainda não existe),
 * mantendo primary/accent e o gradiente — decisão documentada no README.
 */

export type Paleta = {
  background: string;
  surface: string;
  surfaceElevated: string;
  input: string;
  borderSubtle: string;
  borderStrong: string;
  primary: string;
  accent: string;
  textPrimary: string;
  textSecondary: string;
  danger: string;
  success: string;
  overlay: string;
};

/** Tema escuro oficial (Obsidian Lumina). */
export const paletaEscura: Paleta = {
  background: '#0A0E18',
  surface: '#0F131D',
  surfaceElevated: '#171B26',
  input: '#1E293B',
  borderSubtle: '#1E293B',
  borderStrong: '#334155',
  primary: '#00D2FF',
  accent: '#6366F1',
  textPrimary: '#F8FAFC',
  textSecondary: '#94A3B8',
  danger: '#F87171',
  success: '#34D399',
  overlay: 'rgba(10, 14, 24, 0.72)',
};

/**
 * Tema claro derivado: neutros quentes/frios de baixo contraste para leitura
 * confortável, mantendo a identidade (cyan/indigo) do produto.
 */
export const paletaClara: Paleta = {
  background: '#F6F8FC',
  surface: '#FFFFFF',
  surfaceElevated: '#EEF2F9',
  input: '#E8EEF7',
  borderSubtle: '#DCE4F0',
  borderStrong: '#C3CFE2',
  primary: '#0099CC', // cyan levemente escurecido para contraste em fundo claro
  accent: '#6366F1',
  textPrimary: '#0B1220',
  textSecondary: '#5B6B84',
  danger: '#DC2626',
  success: '#059669',
  overlay: 'rgba(11, 18, 32, 0.45)',
};

/** Gradiente de destaque (botões primários e cabeçalhos). */
export const gradiente = ['#00D2FF', '#6366F1'] as const;

/** Famílias carregadas via @expo-google-fonts/plus-jakarta-sans. */
export const fontes = {
  regular: 'PlusJakartaSans_400Regular',
  medium: 'PlusJakartaSans_500Medium',
  semiBold: 'PlusJakartaSans_600SemiBold',
  bold: 'PlusJakartaSans_700Bold',
} as const;

/** Escala de espaçamento (múltiplos de 4). */
export const espacos = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const raios = {
  sm: 8,
  md: 14,
  lg: 20,
  xl: 28,
  pill: 999,
} as const;

/** Categorias do produto: slug (API) -> rótulo, emoji e cor. */
export const categorias = [
  { slug: 'gastos_obrigatorios', rotulo: 'Gastos Obrigatórios', emoji: '📌', cor: '#6366F1' },
  { slug: 'alimentacao', rotulo: 'Alimentação', emoji: '🍽️', cor: '#F59E0B' },
  { slug: 'transporte', rotulo: 'Transporte', emoji: '🚌', cor: '#10B981' },
  { slug: 'lazer', rotulo: 'Lazer', emoji: '🎬', cor: '#00D2FF' },
  { slug: 'saude', rotulo: 'Saúde', emoji: '💊', cor: '#EF4444' },
  { slug: 'educacao', rotulo: 'Educação', emoji: '📚', cor: '#A855F7' },
  { slug: 'outros', rotulo: 'Outros', emoji: '🧾', cor: '#94A3B8' },
] as const;

export type SlugCategoria = (typeof categorias)[number]['slug'];

/** Busca os metadados visuais de uma categoria (fallback: "outros"). */
export function dadosCategoria(slug: string) {
  return categorias.find((categoria) => categoria.slug === slug) ?? categorias[categorias.length - 1];
}
