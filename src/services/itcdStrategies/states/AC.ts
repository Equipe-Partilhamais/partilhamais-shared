
import { ItcdStrategy, ItcdStrategyParams, ItcdResult } from '../types';

export const ACStrategy: ItcdStrategy = {
    calculate({ baseValue }: ItcdStrategyParams): ItcdResult {
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
