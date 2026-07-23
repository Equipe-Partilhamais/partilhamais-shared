"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RSStrategy = void 0;
const utils_1 = require("../utils");
const fiscalUnitsApi_1 = require("../../fiscalUnitsApi");
exports.RSStrategy = {
    calculate({ baseValue, taxType }) {
        const safeBaseValue = baseValue || 0;
        const unit = fiscalUnitsApi_1.fiscalUnitsApi.getUnit('RS') || { name: 'UPF-RS', value: 27.24 };
        const valueInUpf = safeBaseValue / unit.value;
        let taxInUpf = 0;
        let memory = [];
        let legalText = '';
        if (taxType === 'DOACAO') {
            // Regra Doação RS (da imagem): Até 10k UPF 3%, > 10k 4%
            const result = (0, utils_1.calculateMarginalTax)(valueInUpf, [
                { limit: 10000, rate: 0.03 },
                { limit: Infinity, rate: 0.04 }
            ], { name: unit.name, value: unit.value });
            taxInUpf = result.totalTax;
            memory = result.memory;
            legalText = 'Lei nº 8.821/1989. Doação Progressiva Marginal.';
        }
        else {
            // Regra Causa Mortis RS (da imagem): 2k-10k 3%, 10k-30k 4%, 30k-50k 5%, >50k 6%
            const result = (0, utils_1.calculateMarginalTax)(valueInUpf, [
                { limit: 2000, rate: 0 },
                { limit: 10000, rate: 0.03 },
                { limit: 30000, rate: 0.04 },
                { limit: 50000, rate: 0.05 },
                { limit: Infinity, rate: 0.06 }
            ], { name: unit.name, value: unit.value });
            taxInUpf = result.totalTax;
            memory = result.memory;
            legalText = 'Lei nº 8.821/1989. Causa Mortis Progressiva Marginal.';
        }
        const totalTaxReais = taxInUpf * unit.value;
        return {
            taxAmount: totalTaxReais,
            effectiveRate: safeBaseValue > 0 ? totalTaxReais / safeBaseValue : 0,
            legalText,
            originalTaxAmount: totalTaxReais,
            discountValue: 0,
            calculationMemory: memory,
            fiscalUnitUsed: { name: unit.name, value: unit.value }
        };
    }
};
