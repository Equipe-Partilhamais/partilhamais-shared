"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PAStrategy = void 0;
exports.PAStrategy = {
    calculate({ baseValue }) {
        const safeBaseValue = baseValue || 0;
        const tax = safeBaseValue * 0.04;
        return {
            taxAmount: tax,
            effectiveRate: 0.04,
            legalText: 'Legislação Estadual do Pará (Aguardando configuração real).',
            originalTaxAmount: tax,
            discountValue: 0
        };
    }
};
