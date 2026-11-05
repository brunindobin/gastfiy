/**
 * Chamadas de agregação — alimentam o dashboard.
 *
 * Toda soma é calculada no backend (SQL), então o app só desenha os números que
 * recebe. Isso mantém a tela fluida mesmo com histórico grande.
 */

import { requisitar } from './client';
import type { AgregacaoAnual, AgregacaoMensal, ResumoDia } from './types';

/** GET /api/v1/agregacoes/resumo?data=AAAA-MM-DD */
export function buscarResumoDia(data: string): Promise<ResumoDia> {
  return requisitar<ResumoDia>(`/api/v1/agregacoes/resumo?data=${encodeURIComponent(data)}`);
}

/** GET /api/v1/agregacoes/mensal?ano=&mes= */
export function buscarMensal(ano: number, mes: number): Promise<AgregacaoMensal> {
  return requisitar<AgregacaoMensal>(`/api/v1/agregacoes/mensal?ano=${ano}&mes=${mes}`);
}

/** GET /api/v1/agregacoes/anual?ano= */
export function buscarAnual(ano: number): Promise<AgregacaoAnual> {
  return requisitar<AgregacaoAnual>(`/api/v1/agregacoes/anual?ano=${ano}`);
}
