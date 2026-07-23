
import { ItcdStrategy, ItcdStrategyParams, ItcdResult } from '../types';
import { calculateSimpleProgressiveTax } from '../utils';

export const BAStrategy: ItcdStrategy = {
    calculate({ baseValue }: ItcdStrategyParams): ItcdResult {
        const safeBaseValue = baseValue || 0;
        
        // Lei nº 7.014/1996 - Progressivo por enquadramento
        const { totalTax, memory } = calculateSimpleProgressiveTax(safeBaseValue, [
            { limit: 100000, rate: 0.035 }, // Abaixo de 100k (Estimado 3.5% ou Isento dependendo do caso, usando 3.5 base padrão)
            { limit: 200000, rate: 0.04 },
            { limit: 300000, rate: 0.06 },
            { limit: Infinity, rate: 0.08 }
        ]);

        return {
            taxAmount: totalTax,
            effectiveRate: safeBaseValue > 0 ? totalTax / safeBaseValue : 0,
            legalText: 'Lei nº 7.014/1996. Progressivo por enquadramento.',
            originalTaxAmount: totalTax,
            discountValue: 0,
            calculationMemory: memory
        };
    }
};
