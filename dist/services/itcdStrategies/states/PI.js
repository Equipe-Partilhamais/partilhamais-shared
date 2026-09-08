"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PIStrategy = void 0;
exports.PIStrategy = {
    calculate({ baseValue }) {
        const safeBaseValue = baseValue || 0;
        const tax = safeBaseValue * 0.04;
        return {
            taxAmount: tax,
            effectiveRate: 0.04,
            legalText: 'ITCD/PI — alíquota de referência de 4%. Tabela estadual não homologada nesta versão.',
            originalTaxAmount: tax,
            discountValue: 0
        };
    }
};
