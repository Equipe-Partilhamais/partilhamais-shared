"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SCStrategy = void 0;
const utils_1 = require("../utils");
exports.SCStrategy = {
    calculate({ baseValue }) {
        const safeBaseValue = baseValue || 0;
        // Tabela Progressiva SC
        const { totalTax, memory } = (0, utils_1.calculateMarginalTax)(safeBaseValue, [
            { limit: 20000, rate: 0.01 },
            { limit: 50000, rate: 0.03 },
            { limit: 150000, rate: 0.05 },
            { limit: Infinity, rate: 0.07 }
        ]);
        return {
            taxAmount: totalTax,
            effectiveRate: safeBaseValue > 0 ? totalTax / safeBaseValue : 0,
            legalText: 'Lei Estadual 13.136/2004. Progressivo (1% a 7%).',
            originalTaxAmount: totalTax,
            discountValue: 0,
            calculationMemory: memory
        };
    }
};
