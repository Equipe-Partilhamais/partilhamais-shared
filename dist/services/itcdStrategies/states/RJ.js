"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RJStrategy = void 0;
const fiscalUnitsApi_1 = require("../../fiscalUnitsApi");
exports.RJStrategy = {
    calculate({ baseValue }) {
        const safeBaseValue = baseValue || 0;
        // RJ usa faixas baseadas em UFIR-RJ
        const unit = fiscalUnitsApi_1.fiscalUnitsApi.getUnit('RJ') || { name: 'UFIR-RJ', value: 4.65 };
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
        const conversionStep = {
            rangeLabel: `Enquadramento (${unit.name})`,
            base: safeBaseValue,
            rate: rateRJ,
            tax: valueInUnit, // Hack para mostrar o valor em UFIR na memoria
            isFiscalUnit: true,
            unitName: unit.name,
            unitValue: unit.value
        };
        return {
            taxAmount: tax,
            effectiveRate: rateRJ,
            legalText: `Lei Estadual 7.174/2015. Base em ${unit.name} (R$ ${unit.value.toFixed(2)}).`,
            originalTaxAmount: tax,
            discountValue: 0,
            calculationMemory: [conversionStep],
            fiscalUnitUsed: { name: unit.name, value: unit.value }
        };
    }
};
