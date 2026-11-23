"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TOStrategy = void 0;
const utils_1 = require("../utils");
exports.TOStrategy = {
    calculate({ baseValue }) {
        const safeBaseValue = baseValue || 0;
        // Progressivo por enquadramento (Faixas estimadas)
        const { totalTax, memory } = (0, utils_1.calculateSimpleProgressiveTax)(safeBaseValue, [
            { limit: 100000, rate: 0.02 }, // Inicial
            { limit: 400000, rate: 0.04 }, // Intermediária
            { limit: 800000, rate: 0.06 }, // Superior
            { limit: Infinity, rate: 0.08 } // Máxima
        ]);
        return {
            taxAmount: totalTax,
            effectiveRate: safeBaseValue > 0 ? totalTax / safeBaseValue : 0,
            // CALC-06: o commit 0499321 registrou estas faixas como divergentes da lei do TO, sem
            // corrigi-las. As alíquotas ficam; o texto deixa de sugerir que há norma por trás delas.
            legalText: 'ITCD/TO — progressivo por enquadramento (2%, 4%, 6%, 8%), sem norma estadual citada. Divergência conhecida: a pesquisa registrada no commit 0499321 apontou que estas faixas não são as da lei do TO.',
            originalTaxAmount: totalTax,
            discountValue: 0,
            calculationMemory: memory
        };
    }
};
