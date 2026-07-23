
import { ItcdStrategy, ItcdStrategyParams, ItcdResult } from '../types';
import { calculateMarginalTax } from '../utils';

export const DFStrategy: ItcdStrategy = {
    calculate({ baseValue }: ItcdStrategyParams): ItcdResult {
        const safeBaseValue = baseValue || 0;

        // Tabela Progressiva DF (Exemplo fornecido pelo usuário: 4%, 5%, 6%)
        // Até 1M -> 4%
        // 1M a 2M -> 5%
        // Acima de 2M -> 6%
        const { totalTax, memory } = calculateMarginalTax(safeBaseValue, [
            { limit: 1000000, rate: 0.04 },
            { limit: 2000000, rate: 0.05 },
            { limit: Infinity, rate: 0.06 }
        ]);

        return {
            taxAmount: totalTax,
            effectiveRate: safeBaseValue > 0 ? totalTax / safeBaseValue : 0,
            legalText: 'Lei Distrital 3.804/2006. Tabela Progressiva (4%, 5%, 6%).',
            originalTaxAmount: totalTax,
            discountValue: 0,
            calculationMemory: memory
        };
    }
};
