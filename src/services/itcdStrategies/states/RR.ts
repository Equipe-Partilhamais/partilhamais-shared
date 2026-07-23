
import { ItcdStrategy, ItcdStrategyParams, ItcdResult } from '../types';

export const RRStrategy: ItcdStrategy = {
    calculate({ baseValue }: ItcdStrategyParams): ItcdResult {
        const safeBaseValue = baseValue || 0;
        const tax = safeBaseValue * 0.04;

        return {
            taxAmount: tax,
            effectiveRate: 0.04,
            legalText: 'Legislação Estadual de Roraima (Aguardando configuração real).',
            originalTaxAmount: tax,
            discountValue: 0
        };
    }
};
