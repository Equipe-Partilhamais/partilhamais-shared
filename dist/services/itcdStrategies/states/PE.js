"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PEStrategy = void 0;
exports.PEStrategy = {
    calculate({ baseValue }) {
        const safeBaseValue = baseValue || 0;
        let rate = 0;
        let deduction = 0;
        let rangeLabel = '';
        if (safeBaseValue <= 80000) {
            rate = 0;
            deduction = 0;
            rangeLabel = 'Isento até R$ 80.000,00';
        }
        else if (safeBaseValue <= 350000) {
            rate = 0.02;
            deduction = 1600;
            rangeLabel = 'Faixa 2: 2% (Dedução R$ 1.600,00)';
        }
        else if (safeBaseValue <= 550000) {
            rate = 0.04;
            deduction = 8600;
            rangeLabel = 'Faixa 3: 4% (Dedução R$ 8.600,00)';
        }
        else if (safeBaseValue <= 750000) {
            rate = 0.06;
            deduction = 19600;
            rangeLabel = 'Faixa 4: 6% (Dedução R$ 19.600,00)';
        }
        else {
            rate = 0.08;
            deduction = 34600;
            rangeLabel = 'Faixa 5: 8% (Dedução R$ 34.600,00)';
        }
        const taxAmount = Math.max(0, (safeBaseValue * rate) - deduction);
        const memory = [
            {
                rangeLabel,
                base: safeBaseValue,
                rate: rate,
                tax: taxAmount,
                isFiscalUnit: false
            }
        ];
        return {
            taxAmount,
            effectiveRate: safeBaseValue > 0 ? taxAmount / safeBaseValue : 0,
            legalText: 'Lei nº 13.974/2009. Progressivo com parcela a deduzir.',
            calculationMemory: memory,
            originalTaxAmount: taxAmount,
            discountValue: 0
        };
    }
};
