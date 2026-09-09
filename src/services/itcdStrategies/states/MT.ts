
import { ItcdStrategy, ItcdStrategyParams, ItcdResult } from '../types';
import { calculateSimpleProgressiveTax, buildConversionStep } from '../utils';
import { fiscalUnitsApi } from '../../fiscalUnitsApi';

export const MTStrategy: ItcdStrategy = {
    calculate({ baseValue, deathDate }: ItcdStrategyParams): ItcdResult {
        const safeBaseValue = baseValue || 0;

        // Valor da UPF vigente na data do fato gerador
        const unit = fiscalUnitsApi.requireUnit('MT', { id: 'UPF_MT', name: 'UPF/MT', value: 239.51 }, deathDate);

        // Converter valor para UPF
        const valueInUpf = safeBaseValue / unit.value;

        // Tabela Progressiva NÃO Cumulativa (Lei nº 7.850/2002) - Faixas em UPF
        const { totalTax: taxInUpf, memory } = calculateSimpleProgressiveTax(valueInUpf, [
            { limit: 1500, rate: 0.00 }, // Isento até 1.500 UPF
            { limit: 4000, rate: 0.02 },
            { limit: 8000, rate: 0.04 },
            { limit: 16000, rate: 0.06 },
            { limit: Infinity, rate: 0.08 }
        ], { name: unit.name, value: unit.value, vigenciaInicio: unit.vigenciaInicio });

        // Reconverte imposto para Reais
        const totalTaxReais = taxInUpf * unit.value;

        const conversionStep = buildConversionStep(
            `Conversão para ${unit.name}`,
            safeBaseValue,
            valueInUpf,
            { name: unit.name, value: unit.value, vigenciaInicio: unit.vigenciaInicio }
        );

        return {
            taxAmount: totalTaxReais,
            effectiveRate: safeBaseValue > 0 ? totalTaxReais / safeBaseValue : 0,
            legalText: `Lei nº 7.850/2002. Base convertida em ${unit.name} (R$ ${unit.value.toFixed(2)}).`,
            originalTaxAmount: totalTaxReais,
            discountValue: 0,
            calculationMemory: [conversionStep, ...memory],
            fiscalUnitUsed: {
                name: unit.name,
                value: unit.value,
                vigenciaInicio: unit.vigenciaInicio,
                source: unit.source,
                outdated: unit.outdated,
                conferida: unit.conferida,
            },
        };
    }
};
