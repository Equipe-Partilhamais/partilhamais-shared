
import { ItcdStrategy, ItcdStrategyParams, ItcdResult } from '../types';

export const PBStrategy: ItcdStrategy = {
    calculate({ baseValue }: ItcdStrategyParams): ItcdResult {
        const safeBaseValue = baseValue || 0;
        // Alíquota única: 4%
        const tax = safeBaseValue * 0.04;

        return {
            taxAmount: tax,
            effectiveRate: 0.04,
            legalText: 'Legislação Estadual PB. Alíquota única de 4%.',
            originalTaxAmount: tax,
            discountValue: 0
        };
    }
};
