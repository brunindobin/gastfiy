/**
 * Utilitários de formatação — funções puras, sem React.
 *
 * Por que isolar: são as regras mais fáceis de errar (fuso horário, separador
 * de milhar, saudação) e as mais usadas pelas telas. Puras = testáveis sem
 * renderizar nada.
 */

/** Converte uma data local para `AAAA-MM-DD` (sem passar por UTC). */
export function paraISO(data: Date): string {
  const ano = data.getFullYear();
  const mes = String(data.getMonth() + 1).padStart(2, '0');
  const dia = String(data.getDate()).padStart(2, '0');
  return `${ano}-${mes}-${dia}`;
}

/** Data de hoje no formato da API. */
export function hojeISO(): string {
  return paraISO(new Date());
}

/** Soma (ou subtrai) dias a uma data ISO, mantendo o fuso local. */
export function somarDiasISO(iso: string, dias: number): string {
  const [ano, mes, dia] = iso.split('-').map(Number);
  const data = new Date(ano, mes - 1, dia);
  data.setDate(data.getDate() + dias);
  return paraISO(data);
}

/** `2026-11-05` -> `05/11/2026`. */
export function formatarData(iso: string): string {
  const [ano, mes, dia] = iso.split('-');
  return `${dia}/${mes}/${ano}`;
}

/** `2026-11-05` -> `quinta-feira, 5 de novembro`. */
export function formatarDataPorExtenso(iso: string): string {
  const [ano, mes, dia] = iso.split('-').map(Number);
  const data = new Date(ano, mes - 1, dia);
  const texto = data.toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

/** Rótulo curto do dia para o seletor: Hoje / Ontem / 03/11. */
export function rotuloDoDia(iso: string): string {
  const hoje = hojeISO();
  if (iso === hoje) return 'Hoje';
  if (iso === somarDiasISO(hoje, -1)) return 'Ontem';
  return formatarData(iso);
}

/** Saudação de acordo com a hora do aparelho. */
export function saudacao(data: Date = new Date()): string {
  const hora = data.getHours();
  if (hora < 12) return 'Bom dia';
  if (hora < 18) return 'Boa tarde';
  return 'Boa noite';
}

/** `R$ 1.234,56` — implementação manual para não depender de Intl no Hermes. */
export function formatarMoeda(valor: number): string {
  const negativo = valor < 0;
  const absoluto = Math.abs(valor);
  const [inteiro, decimal] = absoluto.toFixed(2).split('.');
  const comMilhar = inteiro.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${negativo ? '-' : ''}R$ ${comMilhar},${decimal}`;
}

/** Hora atual no formato `HH:MM`. */
export function formatarHora(data: Date = new Date()): string {
  return `${String(data.getHours()).padStart(2, '0')}:${String(data.getMinutes()).padStart(2, '0')}`;
}

/**
 * Converte o texto digitado em número.
 *
 * Aceita "1.234,56", "1234,56" e "1234.56". Retorna `null` quando não é um
 * valor monetário válido (> 0), para a tela mostrar erro em vez de enviar lixo.
 */
export function parseValor(texto: string): number | null {
  const limpo = texto
    .replace(/R\$/g, '')
    .replace(/\s/g, '')
    .trim();
  if (!limpo) return null;

  // Com vírgula, ela é o separador decimal e o ponto é de milhar.
  const normalizado = limpo.includes(',')
    ? limpo.replace(/\./g, '').replace(',', '.')
    : limpo;

  const numero = Number(normalizado);
  if (!Number.isFinite(numero) || numero <= 0) return null;

  // Limita a 2 casas (mesma regra da API).
  return Math.round(numero * 100) / 100;
}

/** Formata o valor digitado enquanto o usuário digita (sem perder a vírgula). */
export function formatarEntradaValor(texto: string): string {
  const apenasNumerosEVirgula = texto.replace(/[^0-9,]/g, '');
  const partes = apenasNumerosEVirgula.split(',');
  if (partes.length === 1) return partes[0];
  return `${partes[0]},${partes.slice(1).join('').slice(0, 2)}`;
}

/**
 * Aplica a máscara `DD/MM/AAAA` enquanto o usuário digita.
 *
 * Trabalhar com dígitos (e não com a string já formatada) evita o clássico bug
 * de "não consigo apagar a barra".
 */
export function mascararData(texto: string): string {
  const digitos = texto.replace(/\D/g, '').slice(0, 8);
  if (digitos.length <= 2) return digitos;
  if (digitos.length <= 4) return `${digitos.slice(0, 2)}/${digitos.slice(2)}`;
  return `${digitos.slice(0, 2)}/${digitos.slice(2, 4)}/${digitos.slice(4)}`;
}

/**
 * Converte `DD/MM/AAAA` em `AAAA-MM-DD` validando dia/mês/ano reais.
 *
 * Retorna `null` para data inexistente (ex.: 31/02) — a tela mostra erro em vez
 * de enviar uma data que o backend recusaria.
 */
export function deDataBRparaISO(texto: string): string | null {
  const partes = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(texto.trim());
  if (!partes) return null;

  const dia = Number(partes[1]);
  const mes = Number(partes[2]);
  const ano = Number(partes[3]);

  const data = new Date(ano, mes - 1, dia);
  if (
    data.getFullYear() !== ano ||
    data.getMonth() !== mes - 1 ||
    data.getDate() !== dia
  ) {
    return null;
  }
  return paraISO(data);
}

/** `AAAA-MM-DD` -> `DD/MM/AAAA` (para preencher o formulário de edição). */
export function paraDataBR(iso: string): string {
  return formatarData(iso);
}
