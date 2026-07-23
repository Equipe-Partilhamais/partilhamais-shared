"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SEStrategy = void 0;
exports.SEStrategy = {
    calculate({ baseValue }) {
        const safeBaseValue = baseValue || 0;
        // Alíquota única: 8%
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
