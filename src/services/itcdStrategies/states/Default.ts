
import { ItcdStrategy, ItcdStrategyParams, ItcdResult } from '../types';

export const DefaultStrategy: ItcdStrategy = {
    calculate({ baseValue, taxType }: ItcdStrategyParams): ItcdResult {
        const safeBaseValue = baseValue || 0;
        
        // Padrão nacional médio (4%)
        const tax = safeBaseValue * 0.04;
        const typeLabel = taxType === 'DOACAO' ? 'Doação' : 'Causa Mortis';

        return {
            taxAmount: tax,
            effectiveRate: 0.04,
            legalText: `Legislação Estadual Padrão (${typeLabel}). Consulte o Regulamento do Estado.`,
            originalTaxAmount: tax,
            discountValue: 0
        };
    }
};
