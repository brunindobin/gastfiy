/**
 * Chamadas do recurso `Gasto` (CRUD + filtros + paginação).
 *
 * O backend espera query params repetíveis para categoria
 * (`?categoria=lazer&categoria=saude`), por isso a URL é montada à mão em vez
 * de usar URLSearchParams — no Hermes a implementação varia entre versões.
 */

import { requisitar } from './client';
import type { FiltrosGastos, Gasto, ListaGastos, NovoGasto } from './types';

/** Monta a query string ignorando valores vazios. */
function montarQuery(filtros: FiltrosGastos): string {
  const partes: string[] = [];

  const adicionar = (chave: string, valor: string | number | undefined) => {
    if (valor === undefined || valor === '') return;
    partes.push(`${chave}=${encodeURIComponent(String(valor))}`);
  };

  adicionar('data', filtros.data);
  adicionar('data_inicio', filtros.data_inicio);
  adicionar('data_fim', filtros.data_fim);
  adicionar('busca', filtros.busca);
  adicionar('limite', filtros.limite);
  adicionar('offset', filtros.offset);

  // Categoria é repetível: cada item vira um par próprio.
  for (const categoria of filtros.categorias ?? []) {
    adicionar('categoria', categoria);
  }

  return partes.length > 0 ? `?${partes.join('&')}` : '';
}

/** GET /api/v1/gastos — lista filtrada e paginada. */
export function listarGastos(filtros: FiltrosGastos = {}): Promise<ListaGastos> {
  return requisitar<ListaGastos>(`/api/v1/gastos${montarQuery(filtros)}`);
}

/** POST /api/v1/gastos — cria um gasto. */
export function criarGasto(dados: NovoGasto): Promise<Gasto> {
  return requisitar<Gasto>('/api/v1/gastos', { metodo: 'POST', corpo: dados });
}

/** PUT /api/v1/gastos/{id} — atualização parcial (só os campos enviados). */
export function atualizarGasto(id: string, dados: Partial<NovoGasto>): Promise<Gasto> {
  return requisitar<Gasto>(`/api/v1/gastos/${id}`, { metodo: 'PUT', corpo: dados });
}

/** DELETE /api/v1/gastos/{id} — 204 sem corpo. */
export function removerGasto(id: string): Promise<void> {
  return requisitar<void>(`/api/v1/gastos/${id}`, { metodo: 'DELETE' });
}
