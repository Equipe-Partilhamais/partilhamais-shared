"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BAStrategy = void 0;
const utils_1 = require("../utils");
// Lei/BA nº 4.826, de 27/01/1989 (ITD), art. 9º, na redação da Lei nº 14.802, de 26/12/2024
// (DOE 27/12/2024), com efeitos desde 27/03/2025. Texto conferido em 09/09/2026 no Portal de
// Legislação da Casa Civil da Bahia:
// https://www.legislabahia.ba.gov.br/documentos/lei-no-4826-de-27-de-janeiro-de-1989
//
// O legalText anterior citava a Lei nº 7.014/1996, que é a lei do ICMS baiano, e a primeira
// faixa tributava a 3,5% ("estimado") onde o art. 4º, V ISENTA: são isentas as transmissões
// causa mortis cujo valor DO QUINHÃO seja de até R$ 100.000,00 (critério por quinhão desde
// 27/03/2025; antes era pelo espólio inteiro). Um quinhão de R$ 90.000 pagava R$ 3.150 indevidos.
//
// Enquadramento simples, não decomposição em faixas: o art. 11 manda calcular "aplicando-se a
// alíquota cabível à base de cálculo", e o art. 9º define a alíquota pelo valor total do
// quinhão ou da doação. O método não muda em relação à versão anterior — só as faixas.
const FAIXAS_CAUSA_MORTIS = [
    { limit: 100000, rate: 0 }, // art. 4º, V — isenção por quinhão
    { limit: 200000, rate: 0.04 }, // art. 9º, II, "a"
    { limit: 300000, rate: 0.06 }, // "b"
    { limit: Infinity, rate: 0.08 }, // "c"
];
// Tabela própria do art. 9º, I. Não há isenção geral por valor mínimo na doação.
const FAIXAS_DOACAO = [
    { limit: 200000, rate: 0.03 }, // art. 9º, I, "a"
    { limit: 300000, rate: 0.035 }, // "b"
    { limit: Infinity, rate: 0.04 }, // "c"
];
exports.BAStrategy = {
    calculate({ baseValue, taxType }) {
        const safeBaseValue = baseValue || 0;
        const doacao = taxType === 'DOACAO';
        const { totalTax, memory } = (0, utils_1.calculateSimpleProgressiveTax)(safeBaseValue, doacao ? FAIXAS_DOACAO : FAIXAS_CAUSA_MORTIS);
        return {
            taxAmount: totalTax,
            effectiveRate: safeBaseValue > 0 ? totalTax / safeBaseValue : 0,
            legalText: doacao
                ? 'Lei/BA nº 4.826/1989, art. 9º, I (red. Lei nº 14.802/2024, efeitos desde 27/03/2025). Enquadramento pelo valor da doação: 3% até R$ 200.000,00; 3,5% até R$ 300.000,00; 4% acima.'
                : 'Lei/BA nº 4.826/1989, art. 9º, II (red. Lei nº 14.802/2024, efeitos desde 27/03/2025) c/c art. 4º, V. Enquadramento pelo valor do quinhão: isento até R$ 100.000,00; 4% até R$ 200.000,00; 6% até R$ 300.000,00; 8% acima.',
            originalTaxAmount: totalTax,
            discountValue: 0,
            calculationMemory: memory
        };
    }
};
