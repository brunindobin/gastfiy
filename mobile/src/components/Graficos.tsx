/**
 * Gráficos do dashboard desenhados com react-native-svg.
 *
 * Por que não usar uma lib de gráficos: as necessidades são simples (barras e
 * rosca), e uma dependência pesada aumentaria o bundle e o risco de quebrar no
 * Android. Aqui controlamos o visual e o custo de renderização.
 *
 * Ambos medem a largura disponível com `onLayout` para se adaptarem a qualquer
 * tela, sem valores mágicos de pixel.
 */

import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Line, Rect, Text as SvgText } from 'react-native-svg';

import { useTema } from '../theme/ThemeProvider';
import { espacos, fontes, raios } from '../theme/tokens';
import { formatarMoeda } from '../utils/formato';

type PontoBarra = { rotulo: string; valor: number };

type PropsBarras = {
  dados: PontoBarra[];
  /** Altura da área das barras (sem os rótulos). */
  altura?: number;
  cor?: string;
};

/**
 * Gráfico de barras vertical.
 *
 * Os rótulos são espaçados automaticamente (`passo`) para não sobrepor quando
 * a série tem 31 dias — o requisito é leitura confortável, não mostrar tudo.
 */
export function GraficoBarras({ dados, altura = 150, cor }: PropsBarras) {
  const { cores } = useTema();
  const [largura, setLargura] = useState(0);

  const corBarra = cor ?? cores.primary;
  const maximo = Math.max(...dados.map((ponto) => ponto.valor), 1);
  const espacoEntre = 3;
  const larguraBarra =
    dados.length > 0 && largura > 0
      ? Math.max(2, (largura - espacoEntre * (dados.length - 1)) / dados.length)
      : 0;

  // Mostra no máximo ~8 rótulos, independentemente do tamanho da série.
  const passo = Math.max(1, Math.ceil(dados.length / 8));

  return (
    <View onLayout={(evento) => setLargura(evento.nativeEvent.layout.width)}>
      {largura > 0 ? (
        <Svg width={largura} height={altura + 18}>
          {/* Linha de base para dar referência visual ao zero. */}
          <Line
            x1={0}
            y1={altura}
            x2={largura}
            y2={altura}
            stroke={cores.borderSubtle}
            strokeWidth={1}
          />

          {dados.map((ponto, indice) => {
            const alturaBarra = (ponto.valor / maximo) * (altura - 8);
            const x = indice * (larguraBarra + espacoEntre);
            const y = altura - alturaBarra;

            return (
              <Rect
                key={`${ponto.rotulo}-${indice}`}
                x={x}
                y={y}
                width={larguraBarra}
                height={Math.max(ponto.valor > 0 ? 2 : 0, alturaBarra)}
                rx={Math.min(3, larguraBarra / 2)}
                fill={ponto.valor > 0 ? corBarra : cores.borderSubtle}
                opacity={ponto.valor > 0 ? 1 : 0.35}
              />
            );
          })}

          {dados.map((ponto, indice) => {
            if (indice % passo !== 0 && indice !== dados.length - 1) return null;
            const x = indice * (larguraBarra + espacoEntre) + larguraBarra / 2;
            return (
              <SvgText
                key={`rotulo-${ponto.rotulo}-${indice}`}
                x={x}
                y={altura + 14}
                fontSize={9}
                fill={cores.textSecondary}
                textAnchor="middle"
                fontFamily={fontes.regular}
              >
                {ponto.rotulo}
              </SvgText>
            );
          })}
        </Svg>
      ) : (
        <View style={{ height: altura + 18 }} />
      )}
    </View>
  );
}

type Fatia = { rotulo: string; valor: number; cor: string };

type PropsDonut = {
  dados: Fatia[];
  tamanho?: number;
  espessura?: number;
};

/**
 * Gráfico de rosca (donut) com legenda.
 *
 * Cada fatia é um `Circle` com `strokeDasharray`; o deslocamento acumulado
 * (`strokeDashoffset`) posiciona a fatia na sequência. A rotação de -90° faz o
 * desenho começar no topo, como o usuário espera.
 */
export function GraficoDonut({ dados, tamanho = 180, espessura = 22 }: PropsDonut) {
  const { cores } = useTema();
  const total = dados.reduce((soma, fatia) => soma + fatia.valor, 0);

  const raio = (tamanho - espessura) / 2;
  const centro = tamanho / 2;
  const circunferencia = 2 * Math.PI * raio;

  let acumulado = 0;

  return (
    <View style={styles.donutContainer}>
      <View style={{ width: tamanho, height: tamanho }}>
        <Svg width={tamanho} height={tamanho}>
          {/* Anel de fundo: aparece quando não há dados. */}
          <Circle
            cx={centro}
            cy={centro}
            r={raio}
            stroke={cores.borderSubtle}
            strokeWidth={espessura}
            fill="none"
          />

          {total > 0 &&
            dados.map((fatia, indice) => {
              const comprimento = (fatia.valor / total) * circunferencia;
              const deslocamento = -acumulado;
              acumulado += comprimento;

              return (
                <Circle
                  key={`${fatia.rotulo}-${indice}`}
                  cx={centro}
                  cy={centro}
                  r={raio}
                  stroke={fatia.cor}
                  strokeWidth={espessura}
                  fill="none"
                  strokeDasharray={`${comprimento} ${circunferencia - comprimento}`}
                  strokeDashoffset={deslocamento}
                  strokeLinecap="butt"
                  transform={`rotate(-90 ${centro} ${centro})`}
                />
              );
            })}
        </Svg>

        <View style={[styles.centroDonut, { width: tamanho, height: tamanho }]}>
          <Text style={[styles.totalRotulo, { color: cores.textSecondary }]}>Total</Text>
          <Text style={[styles.totalValor, { color: cores.textPrimary }]} numberOfLines={1}>
            {formatarMoeda(total)}
          </Text>
        </View>
      </View>

      <View style={styles.legenda}>
        {dados.map((fatia) => (
          <View key={fatia.rotulo} style={styles.itemLegenda}>
            <View style={[styles.bolinha, { backgroundColor: fatia.cor }]} />
            <Text style={[styles.legendaTexto, { color: cores.textSecondary }]} numberOfLines={1}>
              {fatia.rotulo}
            </Text>
            <Text style={[styles.legendaValor, { color: cores.textPrimary }]}>
              {total > 0 ? `${Math.round((fatia.valor / total) * 100)}%` : '0%'}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  donutContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacos.lg,
    flexWrap: 'wrap',
  },
  centroDonut: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  totalRotulo: { fontFamily: fontes.regular, fontSize: 11 },
  totalValor: { fontFamily: fontes.bold, fontSize: 15, marginTop: 2 },
  legenda: { flex: 1, minWidth: 130, gap: espacos.sm },
  itemLegenda: { flexDirection: 'row', alignItems: 'center', gap: espacos.sm },
  bolinha: { width: 10, height: 10, borderRadius: raios.pill },
  legendaTexto: { flex: 1, fontFamily: fontes.medium, fontSize: 12 },
  legendaValor: { fontFamily: fontes.semiBold, fontSize: 12 },
});
