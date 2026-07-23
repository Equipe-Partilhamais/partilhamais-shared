"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PRStrategy = void 0;
exports.PRStrategy = {
    calculate({ baseValue }) {
        const safeBaseValue = baseValue || 0;
        const tax = safeBaseValue * 0.04;
        return {
            taxAmount: tax,
            effectiveRate: 0.04,
            legalText: 'Lei Estadual 18.573/2015 (PR) - Aguardando configuração real.',
            originalTaxAmount: tax,
            discountValue: 0
        };
    }
};
