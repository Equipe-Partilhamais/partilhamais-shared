"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ALStrategy = void 0;
const utils_1 = require("../utils");
exports.ALStrategy = {
    calculate({ baseValue }) {
        const safeBaseValue = baseValue || 0;
        // Lei nº 5.077/1989 - Progressivo por enquadramento (não cumulativo)
        const { totalTax, memory } = (0, utils_1.calculateSimpleProgressiveTax)(safeBaseValue, [
            { limit: 25000, rate: 0.00 }, // Isento
            { limit: 150000, rate: 0.02 },
            { limit: 300000, rate: 0.04 },
            { limit: Infinity, rate: 0.06 }
        ]);
        return {
            taxAmount: totalTax,
            effectiveRate: safeBaseValue > 0 ? totalTax / safeBaseValue : 0,
            legalText: 'Lei nº 5.077/1989. Progressivo por enquadramento (não cumulativo).',
            originalTaxAmount: totalTax,
            discountValue: 0,
            calculationMemory: memory
        };
    }
};
