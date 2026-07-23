"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ACStrategy = void 0;
exports.ACStrategy = {
    calculate({ baseValue }) {
        const safeBaseValue = baseValue || 0;
        // Configuração Padrão (Editar conforme legislação do AC)
        const tax = safeBaseValue * 0.04;
        return {
            taxAmount: tax,
            effectiveRate: 0.04,
            legalText: 'Legislação Estadual do Acre (Aguardando configuração real).',
            originalTaxAmount: tax,
            discountValue: 0
        };
    }
};
