/**
 * Testes dos utilitários puros.
 *
 * São a primeira linha de defesa do app: dinheiro, datas e saudação aparecem em
 * todas as telas e um erro aqui contamina o produto inteiro.
 */

import {
  deDataBRparaISO,
  formatarData,
  formatarDataPorExtenso,
  formatarEntradaValor,
  formatarHora,
  formatarMoeda,
  hojeISO,
  mascararData,
  paraDataBR,
  parseValor,
  rotuloDoDia,
  saudacao,
  somarDiasISO,
} from '../src/utils/formato';

describe('formatarMoeda', () => {
  it('formata valores com milhar e duas casas', () => {
    expect(formatarMoeda(1234.5)).toBe('R$ 1.234,50');
    expect(formatarMoeda(0)).toBe('R$ 0,00');
    expect(formatarMoeda(9.9)).toBe('R$ 9,90');
  });

  it('formata milhões e negativos', () => {
    expect(formatarMoeda(1234567.89)).toBe('R$ 1.234.567,89');
    expect(formatarMoeda(-15.5)).toBe('-R$ 15,50');
  });
});

describe('parseValor', () => {
  it('aceita os formatos que o usuário digita', () => {
    expect(parseValor('19,90')).toBe(19.9);
    expect(parseValor('1.234,56')).toBe(1234.56);
    expect(parseValor('1234.56')).toBe(1234.56);
    expect(parseValor('R$ 8,00')).toBe(8);
  });

  it('recusa valores inválidos ou não positivos', () => {
    expect(parseValor('')).toBeNull();
    expect(parseValor('abc')).toBeNull();
    expect(parseValor('0')).toBeNull();
    expect(parseValor('-5')).toBeNull();
  });

  it('limita a duas casas decimais', () => {
    expect(parseValor('10,999')).toBe(11);
  });
});

describe('máscara e conversão de datas', () => {
  it('aplica a máscara DD/MM/AAAA enquanto digita', () => {
    expect(mascararData('0')).toBe('0');
    expect(mascararData('05')).toBe('05');
    expect(mascararData('0511')).toBe('05/11');
    expect(mascararData('05112026')).toBe('05/11/2026');
    // Ignora o que passa de 8 dígitos e qualquer letra.
    expect(mascararData('051120269999')).toBe('05/11/2026');
    expect(mascararData('05/11/2026abc')).toBe('05/11/2026');
  });

  it('converte DD/MM/AAAA para ISO somente com data real', () => {
    expect(deDataBRparaISO('05/11/2026')).toBe('2026-11-05');
    expect(deDataBRparaISO('29/02/2024')).toBe('2024-02-29'); // bissexto
    expect(deDataBRparaISO('31/02/2026')).toBeNull();
    expect(deDataBRparaISO('2026-11-05')).toBeNull();
  });

  it('formata datas para exibição', () => {
    expect(formatarData('2026-11-05')).toBe('05/11/2026');
    expect(paraDataBR('2026-11-05')).toBe('05/11/2026');
    expect(formatarDataPorExtenso('2026-11-05')).toContain('novembro');
  });

  it('navega entre dias sem erro de fuso', () => {
    expect(somarDiasISO('2026-11-05', -1)).toBe('2026-11-04');
    expect(somarDiasISO('2026-03-01', -1)).toBe('2026-02-28');
    expect(somarDiasISO('2026-12-31', 1)).toBe('2027-01-01');
  });

  it('rotula hoje, ontem e datas antigas', () => {
    const hoje = hojeISO();
    expect(rotuloDoDia(hoje)).toBe('Hoje');
    expect(rotuloDoDia(somarDiasISO(hoje, -1))).toBe('Ontem');
    expect(rotuloDoDia('2020-01-02')).toBe('02/01/2020');
  });
});

describe('saudação e hora', () => {
  it('muda conforme o período do dia', () => {
    expect(saudacao(new Date(2026, 10, 5, 6, 0))).toBe('Bom dia');
    expect(saudacao(new Date(2026, 10, 5, 12, 0))).toBe('Boa tarde');
    expect(saudacao(new Date(2026, 10, 5, 18, 0))).toBe('Boa noite');
    expect(saudacao(new Date(2026, 10, 5, 23, 59))).toBe('Boa noite');
  });

  it('formata a hora com dois dígitos', () => {
    expect(formatarHora(new Date(2026, 10, 5, 9, 5))).toBe('09:05');
    expect(formatarHora(new Date(2026, 10, 5, 21, 40))).toBe('21:40');
  });
});

describe('formatarEntradaValor', () => {
  it('mantém apenas dígitos e uma vírgula com 2 casas', () => {
    expect(formatarEntradaValor('12a3')).toBe('123');
    expect(formatarEntradaValor('12,345')).toBe('12,34');
    expect(formatarEntradaValor('12,3,4')).toBe('12,34');
  });
});
