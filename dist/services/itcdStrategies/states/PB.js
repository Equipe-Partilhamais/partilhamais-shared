"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PBStrategy = void 0;
const utils_1 = require("../utils");
// Lei nº 5.123, de 27/01/1989, art. 6º, na redação do art. 2º, I, da Lei nº 12.585, de
// 10/03/2023. Texto conferido em 09/09/2026 no portal da SEFAZ-PB, em
// https://www.sefaz.pb.gov.br/legislacao/66-leis/itcd/6138-lei-n-5-123-de-27-de-janeiro-de-1990
// (a página empilha as redações revogadas; vale a que traz a nota da Lei nº 12.585/23).
//
// O método é MARGINAL por determinação expressa do parágrafo único do art. 6º: "A apuração do
// imposto devido será efetuada mediante a decomposição em faixas de valores totais dos bens e
// direitos transmitidos, aplicando-se a cada uma das faixas a alíquota respectiva."
// O código cobrava 4% fixo — em R$ 1.000.000 eram R$ 40.000 contra R$ 49.500 da lei.
//
// As faixas da doação NÃO são as da causa mortis: o inciso II quebra em R$ 1.000.000 e
// R$ 2.000.000, o inciso I quebra em R$ 400.000 e R$ 1.000.000.
const FAIXAS_CAUSA_MORTIS = [
    { limit: 125000, rate: 0.02 }, // art. 6º, I, "a"
    { limit: 400000, rate: 0.04 }, // "b"
    { limit: 1000000, rate: 0.06 }, // "c"
    { limit: Infinity, rate: 0.08 }, // "d"
];
const FAIXAS_DOACAO = [
    { limit: 125000, rate: 0.02 }, // art. 6º, II, "a"
    { limit: 1000000, rate: 0.04 }, // "b"
    { limit: 2000000, rate: 0.06 }, // "c"
    { limit: Infinity, rate: 0.08 }, // "d"
];
exports.PBStrategy = {
    calculate({ baseValue, taxType }) {
        const safeBaseValue = baseValue || 0;
        const doacao = taxType === 'DOACAO';
        const { totalTax, memory } = (0, utils_1.calculateMarginalTax)(safeBaseValue, doacao ? FAIXAS_DOACAO : FAIXAS_CAUSA_MORTIS);
        return {
            taxAmount: totalTax,
            effectiveRate: safeBaseValue > 0 ? totalTax / safeBaseValue : 0,
            legalText: doacao
                ? 'Lei/PB nº 5.123/1989, art. 6º, II (red. Lei nº 12.585/2023). Decomposição em faixas (parágrafo único): 2% até R$ 125.000,00; 4% até R$ 1.000.000,00; 6% até R$ 2.000.000,00; 8% acima.'
                : 'Lei/PB nº 5.123/1989, art. 6º, I (red. Lei nº 12.585/2023). Decomposição em faixas (parágrafo único): 2% até R$ 125.000,00; 4% até R$ 400.000,00; 6% até R$ 1.000.000,00; 8% acima.',
            originalTaxAmount: totalTax,
            discountValue: 0,
            calculationMemory: memory
        };
    }
};
