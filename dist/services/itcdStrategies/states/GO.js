"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GOStrategy = void 0;
exports.GOStrategy = {
    calculate({ baseValue }) {
        const safeBaseValue = baseValue || 0;
        // Alíquota Fixa de 4% (CTE/GO – Lei nº 11.651/1991)
        // Regra histórica até 1966 era 2%, mas assumimos sucessão atual.
        const tax = safeBaseValue * 0.04;
        return {
            taxAmount: tax,
            effectiveRate: 0.04,
            legalText: 'CTE/GO – Lei nº 11.651/1991. Alíquota Fixa de 4% (Não há progressividade).',
            originalTaxAmount: tax,
            discountValue: 0
        };
    }
};
