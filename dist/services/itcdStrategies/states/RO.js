"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ROStrategy = void 0;
const utils_1 = require("../utils");
exports.ROStrategy = {
    calculate({ baseValue }) {
        const safeBaseValue = baseValue || 0;
        // Progressivo por enquadramento
        const { totalTax, memory } = (0, utils_1.calculateSimpleProgressiveTax)(safeBaseValue, [
            { limit: 100000, rate: 0.02 },
            { limit: 300000, rate: 0.03 },
            { limit: Infinity, rate: 0.04 }
        ]);
        return {
            taxAmount: totalTax,
            effectiveRate: safeBaseValue > 0 ? totalTax / safeBaseValue : 0,
            legalText: 'RO: Progressivo por enquadramento (2%, 3%, 4%). Limites de faixa estimados.',
            originalTaxAmount: totalTax,
            discountValue: 0,
            calculationMemory: memory
        };
    }
};
