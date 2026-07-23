"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BAStrategy = void 0;
const utils_1 = require("../utils");
exports.BAStrategy = {
    calculate({ baseValue }) {
        const safeBaseValue = baseValue || 0;
        // Lei nº 7.014/1996 - Progressivo por enquadramento
        const { totalTax, memory } = (0, utils_1.calculateSimpleProgressiveTax)(safeBaseValue, [
            { limit: 100000, rate: 0.035 }, // Abaixo de 100k (Estimado 3.5% ou Isento dependendo do caso, usando 3.5 base padrão)
            { limit: 200000, rate: 0.04 },
            { limit: 300000, rate: 0.06 },
            { limit: Infinity, rate: 0.08 }
        ]);
        return {
            taxAmount: totalTax,
            effectiveRate: safeBaseValue > 0 ? totalTax / safeBaseValue : 0,
            legalText: 'Lei nº 7.014/1996. Progressivo por enquadramento.',
            originalTaxAmount: totalTax,
            discountValue: 0,
            calculationMemory: memory
        };
    }
};
