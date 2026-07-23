"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MAStrategy = void 0;
exports.MAStrategy = {
    calculate({ baseValue }) {
        const safeBaseValue = baseValue || 0;
        const tax = safeBaseValue * 0.04;
        return {
            taxAmount: tax,
            effectiveRate: 0.04,
            legalText: 'Legislação Estadual do Maranhão (Aguardando configuração real).',
            originalTaxAmount: tax,
            discountValue: 0
        };
    }
};
