
import { ItcdStrategy, ItcdStrategyParams, ItcdResult } from '../types';
import { calculateSimpleProgressiveTax } from '../utils';

export const ROStrategy: ItcdStrategy = {
    calculate({ baseValue }: ItcdStrategyParams): ItcdResult {
        const safeBaseValue = baseValue || 0;
        
        // Progressivo por enquadramento
        const { totalTax, memory } = calculateSimpleProgressiveTax(safeBaseValue, [
            { limit: 100000, rate: 0.02 },
            { limit: 300000, rate: 0.03 },
            { limit: Infinity, rate: 0.04 }
        ]);

        return {
            taxAmount: totalTax,
            effectiveRate: safeBaseValue > 0 ? totalTax / safeBaseValue : 0,
            legalText: 'RO: Progressivo por enquadramento (2%, 3%, 4%). Limites de faixa estimados.',
            originalTaxAmount: totalTax,
            discountValue: 0,
            calculationMemory: memory
        };
    }
};
