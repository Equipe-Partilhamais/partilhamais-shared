
import { ItcdStrategy, ItcdStrategyParams, ItcdResult } from '../types';
import { calculateMarginalTax } from '../utils';

// Lei nº 11.651/1991 (CTE/GO), art. 78, na redação da Lei nº 19.021, de 30/09/2015,
// com efeitos desde 01/01/2016. Texto conferido em 09/09/2026 em
// https://appasp.economia.go.gov.br/legislacao/arquivos/Leis/L_19021.htm (SEFAZ/GO).
// O art. 78 não distingue causa mortis de doação: a mesma tabela vale para os dois.
//
// A tabela é MARGINAL, não de enquadramento: os incisos II a IV dizem "sobre o valor da base
// de cálculo que EXCEDER a X até Y". O código cobrava 4% fixo e afirmava "não há
// progressividade" — falso desde 2016, e SUBcobrança a partir de R$ 200.000 (em R$ 1.000.000
// eram R$ 40.000 contra os R$ 63.500 da lei).
const FAIXAS_ART_78 = [
    { limit: 25_000, rate: 0.02 },   // I  — até R$ 25.000,00
    { limit: 200_000, rate: 0.04 },  // II — sobre o que exceder R$ 25.000,00 até R$ 200.000,00
    { limit: 600_000, rate: 0.06 },  // III
    { limit: Infinity, rate: 0.08 }, // IV — teto da Res. SF nº 9/1992
];

export const GOStrategy: ItcdStrategy = {
    calculate({ baseValue }: ItcdStrategyParams): ItcdResult {
        const safeBaseValue = baseValue || 0;
        const { totalTax, memory } = calculateMarginalTax(safeBaseValue, FAIXAS_ART_78);

        return {
            taxAmount: totalTax,
            effectiveRate: safeBaseValue > 0 ? totalTax / safeBaseValue : 0,
            legalText: 'CTE/GO — Lei nº 11.651/1991, art. 78 (red. Lei nº 19.021/2015, efeitos desde 01/01/2016). Progressividade marginal: 2% até R$ 25.000,00; 4% sobre o excedente até R$ 200.000,00; 6% até R$ 600.000,00; 8% acima.',
            originalTaxAmount: totalTax,
            discountValue: 0,
            calculationMemory: memory
        };
    }
};
