/**
 * Tipos do contrato da API (docs/API.md).
 *
 * Centralizar aqui evita divergência entre telas e permite que o TypeScript
 * aponte quebra de contrato em tempo de compilação.
 */

export type Categoria =
  | 'gastos_obrigatorios'
  | 'lazer'
  | 'alimentacao'
  | 'transporte'
  | 'saude'
  | 'educacao'
  | 'outros';

export type Usuario = {
  id: string;
  nome: string;
  email: string;
  criado_em: string;
};

export type RespostaLogin = {
  access_token: string;
  token_type: string;
  expira_em_minutos: number;
  usuario: Usuario;
};

export type Gasto = {
  id: string;
  nome: string;
  valor: number;
  data: string; // AAAA-MM-DD
  categoria: Categoria;
  categoria_rotulo: string;
  criado_em: string;
  atualizado_em: string;
};

export type ListaGastos = {
  total: number;
  itens: Gasto[];
};

export type NovoGasto = {
  nome: string;
  valor: number;
  data: string;
  categoria: Categoria;
};

export type FiltrosGastos = {
  data?: string;
  data_inicio?: string;
  data_fim?: string;
  categorias?: Categoria[];
  busca?: string;
  limite?: number;
  offset?: number;
};

export type TotalCategoria = {
  categoria: Categoria;
  rotulo: string;
  total: number;
  quantidade: number;
};

export type ResumoDia = {
  data: string;
  total: number;
  quantidade: number;
  por_categoria: TotalCategoria[];
};

export type DiaDaSerie = { dia: string; total: number; quantidade: number };
export type MesDaSerie = { mes: number; total: number; quantidade: number };

export type AgregacaoMensal = {
  ano: number;
  mes: number;
  total: number;
  quantidade: number;
  por_categoria: TotalCategoria[];
  por_dia: DiaDaSerie[];
};

export type AgregacaoAnual = {
  ano: number;
  total: number;
  quantidade: number;
  por_mes: MesDaSerie[];
  por_categoria: TotalCategoria[];
};

export type DetalheErro = { campo: string; mensagem: string };
