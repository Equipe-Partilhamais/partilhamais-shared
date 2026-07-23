
import { ItcdStrategy, ItcdStrategyParams, ItcdResult } from '../types';
import { calculateSimpleProgressiveTax } from '../utils';

export const TOStrategy: ItcdStrategy = {
    calculate({ baseValue }: ItcdStrategyParams): ItcdResult {
        const safeBaseValue = baseValue || 0;
        
        // Progressivo por enquadramento (Faixas estimadas)
        const { totalTax, memory } = calculateSimpleProgressiveTax(safeBaseValue, [
            { limit: 100000, rate: 0.02 }, // Inicial
            { limit: 400000, rate: 0.04 }, // Intermediária
            { limit: 800000, rate: 0.06 }, // Superior
            { limit: Infinity, rate: 0.08 } // Máxima
        ]);

        return {
            taxAmount: totalTax,
            effectiveRate: safeBaseValue > 0 ? totalTax / safeBaseValue : 0,
            legalText: 'TO: Progressivo por enquadramento (2%, 4%, 6%, 8%). Limites de faixa estimados.',
            originalTaxAmount: totalTax,
            discountValue: 0,
            calculationMemory: memory
        };
    }
};
