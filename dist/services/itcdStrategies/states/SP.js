"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SPStrategy = void 0;
exports.SPStrategy = {
    calculate({ baseValue, taxType }) {
        const safeBaseValue = baseValue || 0;
        // SP: Alíquota fixa de 4% tanto para Causa Mortis quanto Doação
        const tax = safeBaseValue * 0.04;
        const typeLabel = taxType === 'DOACAO' ? 'Doação' : 'Causa Mortis';
        return {
            taxAmount: tax,
            effectiveRate: 0.04,
            legalText: `Lei Estadual 10.705/2000 (${typeLabel}). Alíquota única de 4%.`,
            originalTaxAmount: tax,
            discountValue: 0
        };
    }
};
