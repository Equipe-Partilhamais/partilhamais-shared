
import { ItcdStrategy, ItcdStrategyParams, ItcdResult } from '../types';

export const MSStrategy: ItcdStrategy = {
    calculate({ baseValue }: ItcdStrategyParams): ItcdResult {
        const safeBaseValue = baseValue || 0;
        // Lei nº 1.810/1997 - Causa Mortis 6% (Sistema não progressivo)
        const tax = safeBaseValue * 0.06;

        return {
            taxAmount: tax,
            effectiveRate: 0.06,
            legalText: 'Lei nº 1.810/1997. Alíquota Fixa de 6% (Causa Mortis).',
            originalTaxAmount: tax,
            discountValue: 0
        };
    }
};
