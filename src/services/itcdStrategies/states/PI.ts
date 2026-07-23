
import { ItcdStrategy, ItcdStrategyParams, ItcdResult } from '../types';

export const PIStrategy: ItcdStrategy = {
    calculate({ baseValue }: ItcdStrategyParams): ItcdResult {
        const safeBaseValue = baseValue || 0;
        const tax = safeBaseValue * 0.04;

        return {
            taxAmount: tax,
            effectiveRate: 0.04,
            legalText: 'Legislação Estadual do Piauí (Aguardando configuração real).',
            originalTaxAmount: tax,
            discountValue: 0
        };
    }
};
