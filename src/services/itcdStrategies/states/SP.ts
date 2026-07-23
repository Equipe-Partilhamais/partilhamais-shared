
import { ItcdStrategy, ItcdStrategyParams, ItcdResult } from '../types';

export const SPStrategy: ItcdStrategy = {
    calculate({ baseValue, taxType }: ItcdStrategyParams): ItcdResult {
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
