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
            legalText: 'ITCD/AC — alíquota de referência de 4%. Tabela estadual não homologada nesta versão.',
            originalTaxAmount: tax,
            discountValue: 0
        };
    }
};
