"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MTStrategy = void 0;
const utils_1 = require("../utils");
const fiscalUnitsApi_1 = require("../../fiscalUnitsApi");
exports.MTStrategy = {
    calculate({ baseValue }) {
        const safeBaseValue = baseValue || 0;
        // Busca valor atualizado da API
        const unit = fiscalUnitsApi_1.fiscalUnitsApi.getUnit('MT') || { name: 'UPF/MT', value: 239.51 };
        // Converter valor para UPF
        const valueInUpf = safeBaseValue / unit.value;
        // Tabela Progressiva NÃO Cumulativa (Lei nº 7.850/2002) - Faixas em UPF
        const { totalTax: taxInUpf, memory } = (0, utils_1.calculateSimpleProgressiveTax)(valueInUpf, [
            { limit: 1500, rate: 0.00 }, // Isento até 1.500 UPF
            { limit: 4000, rate: 0.02 },
            { limit: 8000, rate: 0.04 },
            { limit: 16000, rate: 0.06 },
            { limit: Infinity, rate: 0.08 }
        ], { name: unit.name, value: unit.value });
        // Reconverte imposto para Reais
        const totalTaxReais = taxInUpf * unit.value;
        // Adiciona passo de conversão na memória
        const conversionStep = {
            rangeLabel: `Conversão para ${unit.name}`,
            base: safeBaseValue,
            rate: 1 / unit.value, // Taxa inversa apenas para exibição lógica
            tax: valueInUpf, // Resultado é o valor em UPF
            isFiscalUnit: true,
            unitName: unit.name,
            unitValue: unit.value
        };
        return {
            taxAmount: totalTaxReais,
            effectiveRate: safeBaseValue > 0 ? totalTaxReais / safeBaseValue : 0,
            legalText: `Lei nº 7.850/2002. Base convertida em ${unit.name} (R$ ${unit.value.toFixed(2)}).`,
            originalTaxAmount: totalTaxReais,
            discountValue: 0,
            calculationMemory: [conversionStep, ...memory],
            fiscalUnitUsed: { name: unit.name, value: unit.value }
        };
    }
};
