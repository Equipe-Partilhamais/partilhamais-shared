"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RNStrategy = void 0;
exports.RNStrategy = {
    calculate({ baseValue }) {
        const safeBaseValue = baseValue || 0;
        // Alíquota única: 3%
        const tax = safeBaseValue * 0.03;
        return {
            taxAmount: tax,
            effectiveRate: 0.03,
            legalText: 'Legislação Estadual RN. Alíquota única de 3%.',
            originalTaxAmount: tax,
            discountValue: 0
        };
    }
};
