
import { ItcdStrategy, ItcdStrategyParams, ItcdResult } from '../types';

export const ACStrategy: ItcdStrategy = {
    calculate({ baseValue }: ItcdStrategyParams): ItcdResult {
        const safeBaseValue = baseValue || 0;
        // Configuração Padrão (Editar conforme legislação do AC)
        const tax = safeBaseValue * 0.04;

        return {
            taxAmount: tax,
            effectiveRate: 0.04,
            legalText: 'Legislação Estadual do Acre (Aguardando configuração real).',
            originalTaxAmount: tax,
            discountValue: 0
        };
    }
};
