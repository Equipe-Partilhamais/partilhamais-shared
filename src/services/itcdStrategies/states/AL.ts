
import { ItcdStrategy, ItcdStrategyParams, ItcdResult } from '../types';
import { calculateSimpleProgressiveTax } from '../utils';

// Lei/AL nº 5.077, de 12/06/1989 (CTE/AL), art. 168, na redação do art. 5º, I, da Lei nº 9.440,
// de 27/12/2024. Texto conferido em 09/09/2026 no PDF oficial do SAPL da Assembleia Legislativa
// de Alagoas: https://sapl.al.al.leg.br/media/sapl/public/normajuridica/2024/3246/lei_no_9.440_de_27_de_dezembro_de_2024_3_-_ultima_publicacao.pdf
//
// NENHUMA das faixas que estavam aqui (25k/150k/300k) existe na lei. Em especial, a doação
// usava a tabela de causa mortis: R$ 60.000 numa doação de R$ 1.000.000 contra R$ 20.000 do
// art. 168, II. O RITCD (Decreto nº 10.306/2011, art. 24) ainda traz a redação antiga de
// 4%/2% e NÃO foi atualizado após a Lei 9.440/2024 — prevalece a lei.
//
// MÉTODO EM ABERTO: o art. 168 diz "caso a parcela da base de cálculo (quinhão) seja até X" e
// não tem parágrafo mandando decompor em faixas nem parcela a deduzir. Mantido o enquadramento
// simples que o arquivo já usava; a leitura marginal é defensável e as duas só divergem acima
// do primeiro degrau. Precisa de posição da SEFAZ-AL antes de assinar a conferência.
const FAIXAS_CAUSA_MORTIS = [
    { limit: 1_000_000, rate: 0.04 },   // art. 168, I, "a"
    { limit: 10_000_000, rate: 0.06 },  // "b"
    { limit: Infinity, rate: 0.08 },    // "c" — teto da Res. SF nº 9/1992
];

const FAIXAS_DOACAO = [
    { limit: 50_000, rate: 0.01 },      // art. 168, II, "a"
    { limit: 100_000, rate: 0.015 },    // "b"
    { limit: Infinity, rate: 0.02 },    // "c"
];

export const ALStrategy: ItcdStrategy = {
    calculate({ baseValue, taxType }: ItcdStrategyParams): ItcdResult {
        const safeBaseValue = baseValue || 0;
        const doacao = taxType === 'DOACAO';
        const { totalTax, memory } = calculateSimpleProgressiveTax(
            safeBaseValue,
            doacao ? FAIXAS_DOACAO : FAIXAS_CAUSA_MORTIS
        );

        return {
            taxAmount: totalTax,
            effectiveRate: safeBaseValue > 0 ? totalTax / safeBaseValue : 0,
            legalText: doacao
                ? 'CTE/AL — Lei nº 5.077/1989, art. 168, II (red. Lei nº 9.440/2024). Enquadramento pelo valor da doação: 1% até R$ 50.000,00; 1,5% até R$ 100.000,00; 2% acima.'
                : 'CTE/AL — Lei nº 5.077/1989, art. 168, I (red. Lei nº 9.440/2024). Enquadramento pelo valor do quinhão: 4% até R$ 1.000.000,00; 6% até R$ 10.000.000,00; 8% acima.',
            originalTaxAmount: totalTax,
            discountValue: 0,
            calculationMemory: memory
        };
    }
};
