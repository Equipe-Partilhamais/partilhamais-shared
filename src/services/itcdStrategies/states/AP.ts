
import { ItcdStrategy, ItcdStrategyParams, ItcdResult } from '../types';
import { calculateSimpleProgressiveTax } from '../utils';

export const APStrategy: ItcdStrategy = {
    calculate({ baseValue }: ItcdStrategyParams): ItcdResult {
        const safeBaseValue = baseValue || 0;
        
        // Progressivo por enquadramento (Faixas estimadas pois documento não citou valores)
        const { totalTax, memory } = calculateSimpleProgressiveTax(safeBaseValue, [
            { limit: 100000, rate: 0.03 },
            { limit: 400000, rate: 0.05 },
            { limit: Infinity, rate: 0.06 }
        ]);

        return {
            taxAmount: totalTax,
            effectiveRate: safeBaseValue > 0 ? totalTax / safeBaseValue : 0,
            legalText: 'AP: Progressivo por enquadramento (3%, 5%, 6%). Limites de faixa estimados.',
            originalTaxAmount: totalTax,
            discountValue: 0,
            calculationMemory: memory
        };
    }
};
