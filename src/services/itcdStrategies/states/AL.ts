
import { ItcdStrategy, ItcdStrategyParams, ItcdResult } from '../types';
import { calculateSimpleProgressiveTax } from '../utils';

export const ALStrategy: ItcdStrategy = {
    calculate({ baseValue }: ItcdStrategyParams): ItcdResult {
        const safeBaseValue = baseValue || 0;
        
        // Lei nº 5.077/1989 - Progressivo por enquadramento (não cumulativo)
        const { totalTax, memory } = calculateSimpleProgressiveTax(safeBaseValue, [
            { limit: 25000, rate: 0.00 }, // Isento
            { limit: 150000, rate: 0.02 },
            { limit: 300000, rate: 0.04 },
            { limit: Infinity, rate: 0.06 }
        ]);

        return {
            taxAmount: totalTax,
            effectiveRate: safeBaseValue > 0 ? totalTax / safeBaseValue : 0,
            legalText: 'Lei nº 5.077/1989. Progressivo por enquadramento (não cumulativo).',
            originalTaxAmount: totalTax,
            discountValue: 0,
            calculationMemory: memory
        };
    }
};
