
import { ItcdStrategy, ItcdStrategyParams, ItcdResult } from '../types';

// DIVERGÊNCIA CONHECIDA E GRAVE, NÃO CORRIGIDA NESTA PASSAGEM. Os 8% fixos abaixo são o TETO
// da Lei/SE nº 7.724, de 08/11/2013, aplicado como se fosse alíquota única. O art. 14 tem
// quatro regimes distintos: causa mortis progressiva 3/6/8% (inciso I, faixas de 2.417 e
// 12.086 UFP/SE); 2% linear em causa mortis de QUOTAS DE SOCIEDADE (inciso I-A); doação de
// IMÓVEIS progressiva 2/4/6/8% (inciso II); e 2% linear na doação de BENS MÓVEIS (inciso
// III-A). Fonte: https://legislacaoonline.sefaz.se.gov.br/ITCMD/Leis/2013/lei7724-13.pdf
// O pior caso é a doação de bem móvel de R$ 1.000.000: R$ 80.000 aqui contra R$ 20.000 da lei.
//
// Dois bloqueios de insumo impedem a correção agora:
// 1) as faixas são em UFP/SE, que é fixada POR PORTARIA MENSAL (R$ 86,25 em set/2026) e não
//    existe em services/fiscalUnitsApi.ts — sem a série mensal, o enquadramento de um óbito
//    de 2024 sairia de um índice de 2026, trocando 3% por 6% em torno dos pontos de corte;
// 2) escolher entre os quatro regimes exige saber se o bem é imóvel, móvel ou quota de
//    sociedade, e o motor recebe só o valor da base.
// Implementar só a tabela do inciso I deixaria a doação de móvel — o maior erro em reais —
// ainda errada, e trocaria uma sobrecobrança conhecida por uma sobrecobrança nova.
export const SEStrategy: ItcdStrategy = {
    calculate({ baseValue }: ItcdStrategyParams): ItcdResult {
        const safeBaseValue = baseValue || 0;
        const tax = safeBaseValue * 0.08;

        return {
            taxAmount: tax,
            effectiveRate: 0.08,
            legalText: 'Legislação Estadual SE. Alíquota única de 8%.',
            originalTaxAmount: tax,
            discountValue: 0
        };
    }
};
