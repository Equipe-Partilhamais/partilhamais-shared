"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RJStrategy = void 0;
const fiscalUnitsApi_1 = require("../../fiscalUnitsApi");
exports.RJStrategy = {
    calculate({ baseValue, deathDate }) {
        const safeBaseValue = baseValue || 0;
        // RJ usa faixas baseadas em UFIR-RJ, no valor vigente na data do fato gerador
        const unit = fiscalUnitsApi_1.fiscalUnitsApi.requireUnit('RJ', { id: 'UFIR_RJ', name: 'UFIR-RJ', value: 4.65 }, deathDate);
        const valueInUnit = safeBaseValue / unit.value;
        let rateRJ = 0.04;
        if (valueInUnit <= 70000)
            rateRJ = 0.04;
        else if (valueInUnit <= 100000)
            rateRJ = 0.045;
        else if (valueInUnit <= 200000)
            rateRJ = 0.05;
        else if (valueInUnit <= 300000)
            rateRJ = 0.06;
        else if (valueInUnit <= 400000)
            rateRJ = 0.07;
        else
            rateRJ = 0.08;
        const tax = safeBaseValue * rateRJ;
        // A alíquota incide sobre o total em reais; a UFIR só define o enquadramento. Por isso a
        // linha carrega o imposto REAL e o valor em unidades vai em `valueInUnits`.
        const bracketStep = {
            rangeLabel: `Enquadramento (${valueInUnit.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} ${unit.name})`,
            base: safeBaseValue,
            rate: rateRJ,
            tax,
            isFiscalUnit: true,
            unitName: unit.name,
            unitValue: unit.value,
            valueInUnits: valueInUnit,
            unitVigencia: unit.vigenciaInicio,
        };
        return {
            taxAmount: tax,
            effectiveRate: rateRJ,
            legalText: `Lei Estadual 7.174/2015. Base em ${unit.name} (R$ ${unit.value.toFixed(2)}).`,
            originalTaxAmount: tax,
            discountValue: 0,
            calculationMemory: [bracketStep],
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
