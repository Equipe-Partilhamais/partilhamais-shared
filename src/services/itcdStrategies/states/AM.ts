
import { ItcdStrategy, ItcdStrategyParams, ItcdResult } from '../types';
import { calculateSimpleProgressiveTax } from '../utils';

export const AMStrategy: ItcdStrategy = {
    calculate({ baseValue }: ItcdStrategyParams): ItcdResult {
        const safeBaseValue = baseValue || 0;
        
        // Progressivo por enquadramento (Faixas estimadas)
        const { totalTax, memory } = calculateSimpleProgressiveTax(safeBaseValue, [
            { limit: 100000, rate: 0.02 }, // Inicial
            { limit: 400000, rate: 0.03 }, // Intermediária
            { limit: Infinity, rate: 0.04 } // Superior
        ]);

        return {
            taxAmount: totalTax,
            effectiveRate: safeBaseValue > 0 ? totalTax / safeBaseValue : 0,
            legalText: 'AM: Progressivo por enquadramento (2%, 3%, 4%). Limites de faixa estimados.',
            originalTaxAmount: totalTax,
            discountValue: 0,
            calculationMemory: memory
        };
    }
};
