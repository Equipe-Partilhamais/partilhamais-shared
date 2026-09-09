
import { ItcdStrategy, ItcdStrategyParams, ItcdResult } from '../types';

// DIVERGÊNCIA CONHECIDA, NÃO CORRIGIDA NESTA PASSAGEM. Os 4% fixos abaixo não têm base legal:
// a LC Estadual/AC nº 373, de 11/12/2020, art. 29 (causa mortis) e art. 30 (doação) trazem
// tabelas progressivas — 4/5/6/7% sobre o que exceder R$ 50.000/1,5M/2,5M/3,5M na causa mortis
// e 2/4/6/8% em R$ 25.000/100.000/200.000 na doação. Fonte: https://sefaz.ac.gov.br/2021/?p=5118
//
// Não implementado de propósito, por dois bloqueios que o texto da lei não resolve:
// 1) o método é contraditório dentro do próprio art. 29 — os incisos falam em "sobre o valor
//    que exceder" (marginal), mas o parágrafo único manda, na sobrepartilha, aplicar "a
//    alíquota correspondente ao total do monte-mor" (alíquota única). A diferença de imposto
//    acima de R$ 1.500.000 é grande e depende de parecer/decreto regulamentador;
// 2) o inciso V (8% a colaterais) é alíquota por GRAU DE PARENTESCO, não degrau de valor, e o
//    motor não recebe esse dado — codificá-lo como quinta faixa superfaturaria a guia.
// Codificar qualquer das duas leituras sem decisão do escritório troca um erro conhecido por
// um erro assinado. Ver PROPOSTAS-CONFERENCIA (AC) antes de mexer.
export const ACStrategy: ItcdStrategy = {
    calculate({ baseValue }: ItcdStrategyParams): ItcdResult {
        const safeBaseValue = baseValue || 0;
        const tax = safeBaseValue * 0.04;

        return {
            taxAmount: tax,
            effectiveRate: 0.04,
            legalText: 'ITCD/AC — alíquota de referência de 4%. Tabela estadual não homologada nesta versão.',
            originalTaxAmount: tax,
            discountValue: 0
        };
    }
};
