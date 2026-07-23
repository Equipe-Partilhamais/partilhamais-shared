import { ItcdCalculationMemory } from '../../types';
export type ItcdTaxType = 'CAUSA_MORTIS' | 'DOACAO';
export interface ItcdResult {
    taxAmount: number;
    effectiveRate: number;
    legalText: string;
    discountApplied?: string;
    warningMessage?: string;
    originalTaxAmount?: number;
    discountValue?: number;
    calculationMemory?: ItcdCalculationMemory[];
    fiscalUnitUsed?: {
        name: string;
        value: number;
    };
}
export interface ItcdStrategyParams {
    baseValue: number;
    deathDate?: string;
    taxType: ItcdTaxType;
    settings?: {
        applyInventoryDiscount: boolean;
    };
}
export interface ItcdStrategy {
    calculate(params: ItcdStrategyParams): ItcdResult;
}
