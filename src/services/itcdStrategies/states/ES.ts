
import { ItcdStrategy, ItcdStrategyParams, ItcdResult } from '../types';

export const ESStrategy: ItcdStrategy = {
    calculate({ baseValue }: ItcdStrategyParams): ItcdResult {
        const safeBaseValue = baseValue || 0;
        
        // ES é alíquota fixa de 4%
        const tax = safeBaseValue * 0.04;

        return {
            taxAmount: tax,
            effectiveRate: 0.04,
            legalText: 'Lei Estadual 10.011/2013 (Alterou a Lei 4.215/1989). Regulamentado pelo Decreto 3469-R/2013.',
            originalTaxAmount: tax,
            discountValue: 0
        };
    }
};
