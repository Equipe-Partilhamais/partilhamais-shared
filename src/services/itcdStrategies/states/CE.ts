
import { ItcdStrategy, ItcdStrategyParams, ItcdResult } from '../types';
import { calculateSimpleProgressiveTax, buildConversionStep } from '../utils';
import { fiscalUnitsApi } from '../../fiscalUnitsApi';

export const CEStrategy: ItcdStrategy = {
    calculate({ baseValue, deathDate }: ItcdStrategyParams): ItcdResult {
        const safeBaseValue = baseValue || 0;

        const unit = fiscalUnitsApi.requireUnit('CE', { id: 'UFIRCE', name: 'UFIRCE', value: 5.95 }, deathDate);
        const valueInUnit = safeBaseValue / unit.value;

        // Lei nº 12.670/1996 - Progressivo NÃO cumulativo em UFIRCE
        const { totalTax: taxInUnit, memory } = calculateSimpleProgressiveTax(valueInUnit, [
            { limit: 2500, rate: 0.02 },
            { limit: 5000, rate: 0.04 },
            { limit: 10000, rate: 0.06 },
            { limit: Infinity, rate: 0.08 }
        ], { name: unit.name, value: unit.value, vigenciaInicio: unit.vigenciaInicio });

        const totalTaxReais = taxInUnit * unit.value;

        const conversionStep = buildConversionStep(
            `Conversão Base (${unit.name})`,
            safeBaseValue,
            valueInUnit,
            { name: unit.name, value: unit.value, vigenciaInicio: unit.vigenciaInicio }
        );

        return {
            taxAmount: totalTaxReais,
            effectiveRate: safeBaseValue > 0 ? totalTaxReais / safeBaseValue : 0,
            legalText: `Lei nº 12.670/1996. Base em ${unit.name} (R$ ${unit.value.toFixed(2)}).`,
            originalTaxAmount: totalTaxReais,
            discountValue: 0,
            calculationMemory: [conversionStep, ...memory],
            fiscalUnitUsed: {
                name: unit.name,
                value: unit.value,
                vigenciaInicio: unit.vigenciaInicio,
                source: unit.source,
                outdated: unit.outdated,
            },
        };
    }
};
