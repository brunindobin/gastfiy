/**
 * Tipos de navegação (React Navigation).
 *
 * Tipar os param lists faz o TypeScript avisar quando uma tela é aberta com os
 * parâmetros errados — ex.: esquecer o `gasto` ao abrir a edição.
 */

import type { Gasto } from '../api/types';

export type ParamsRaiz = {
  Login: undefined;
  Abas: undefined;
  /** Sem `gasto` = criação; com `gasto` = edição. */
  NovoGasto: { gasto?: Gasto } | undefined;
};

export type ParamsAbas = {
  Inicio: undefined;
  Dashboard: undefined;
  Filtros: undefined;
  Ajustes: undefined;
};
