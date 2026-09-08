"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CEStrategy = void 0;
const utils_1 = require("../utils");
const fiscalUnitsApi_1 = require("../../fiscalUnitsApi");
exports.CEStrategy = {
    calculate({ baseValue, deathDate }) {
        const safeBaseValue = baseValue || 0;
        const unit = fiscalUnitsApi_1.fiscalUnitsApi.requireUnit('CE', { id: 'UFIRCE', name: 'UFIRCE', value: 5.95 }, deathDate);
        const valueInUnit = safeBaseValue / unit.value;
        // Lei nº 12.670/1996 - Progressivo NÃO cumulativo em UFIRCE
        const { totalTax: taxInUnit, memory } = (0, utils_1.calculateSimpleProgressiveTax)(valueInUnit, [
            { limit: 2500, rate: 0.02 },
            { limit: 5000, rate: 0.04 },
            { limit: 10000, rate: 0.06 },
            { limit: Infinity, rate: 0.08 }
        ], { name: unit.name, value: unit.value, vigenciaInicio: unit.vigenciaInicio });
        const totalTaxReais = taxInUnit * unit.value;
        const conversionStep = (0, utils_1.buildConversionStep)(`Conversão Base (${unit.name})`, safeBaseValue, valueInUnit, { name: unit.name, value: unit.value, vigenciaInicio: unit.vigenciaInicio });
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
