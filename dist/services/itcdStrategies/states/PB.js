"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PBStrategy = void 0;
exports.PBStrategy = {
    calculate({ baseValue }) {
        const safeBaseValue = baseValue || 0;
        // Alíquota única: 4%
        const tax = safeBaseValue * 0.04;
        return {
            taxAmount: tax,
            effectiveRate: 0.04,
            legalText: 'Legislação Estadual PB. Alíquota única de 4%.',
            originalTaxAmount: tax,
            discountValue: 0
        };
    }
};
