import { ItcdStrategy, ItcdStrategyParams, ItcdResult } from '../types';
import { fiscalUnitsApi } from '../../fiscalUnitsApi';

export const MGStrategy: ItcdStrategy = {
    calculate({ baseValue, deathDate, settings, taxType }: ItcdStrategyParams): ItcdResult {
        const safeBaseValue = baseValue || 0;
        
        // --- REGRA DE DOAÇÃO (MG) ---
        // Base: Lei 14.941/2003
        if (taxType === 'DOACAO') {
            const unit = fiscalUnitsApi.getUnit('MG') || { name: 'UFEMG', value: 5.62 }; 
            const valueInUnit = safeBaseValue / unit.value;

            // 1. Alíquota Base: 5% (Conforme correção do usuário)
            const baseTax = safeBaseValue * 0.05;
            
            let taxAmount = baseTax;
            let discountValue = 0;
            let discountApplied = '';
            const memory = [];

            // 2. Desconto do Art. 23-A
            // "Na hipótese de doação cujo valor seja de até 90.000 UFEMGs, será concedido desconto de 50%..."
            if (valueInUnit <= 90000) {
                discountValue = baseTax * 0.50;
                taxAmount = baseTax - discountValue;
                discountApplied = 'Desconto de 50% (Art. 23-A da Lei 14.941/2003)';
            }

            // Memória de Conversão para evidenciar o limite de 90.000 UFEMGs
            memory.push({
                rangeLabel: `Valor em ${unit.name} (Limite p/ desconto: 90.000)`,
                base: safeBaseValue,
                rate: 0,
                tax: valueInUnit, // Hack visual: mostra o valor em UFEMG na coluna de resultado
                isFiscalUnit: true,
                unitName: unit.name,
                unitValue: unit.value
            });

            if (discountApplied) {
                memory.push({
                    rangeLabel: 'Aplicação do Desconto (50%)',
                    base: baseTax,
                    rate: 0.50,
                    tax: discountValue * -1, // Mostra negativo
                    isFiscalUnit: false
                });
            }

            return {
                taxAmount: taxAmount,
                effectiveRate: safeBaseValue > 0 ? taxAmount / safeBaseValue : 0,
                legalText: `Lei 14.941/2003. Alíquota 5%. ${discountApplied ? 'Com benefício do Art. 23-A.' : ''}`,
                originalTaxAmount: baseTax,
                discountValue: discountValue,
                discountApplied: discountApplied,
                calculationMemory: memory,
                fiscalUnitUsed: unit
            };
        }

        // --- REGRA CAUSA MORTIS (MG): 5% Fixo ---
        let tax = safeBaseValue * 0.05; 
        const originalTax = tax;
        let discountApplied = '';
        let warningMessage = '';
        let discountValue = 0;

        // Regra de Desconto de MG (Causa Mortis): 15% se pago em até 90 dias
        if (deathDate && settings?.applyInventoryDiscount) {
            const [y, m, d] = deathDate.split('-').map(Number);
            const death = new Date(y, m - 1, d);
            const today = new Date();
            
            // Calculate difference in days
            const diffTime = Math.abs(today.getTime() - death.getTime());
            const daysDiff = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            
            if (daysDiff <= 90) {
                discountValue = tax * 0.15;
                tax = tax - discountValue; 
                discountApplied = 'Desconto de 15% (Pagamento em até 90 dias do óbito)';
            } else {
                // Add 90 days to death date
                const limitDate = new Date(death);
                limitDate.setDate(limitDate.getDate() + 90);
                warningMessage = `Prazo de 90 dias para desconto expirou em ${limitDate.toLocaleDateString('pt-BR')}.`;
            }
        } else if (settings?.applyInventoryDiscount) {
            warningMessage = 'Data do óbito não informada. Desconto não calculado.';
        }

        return {
            taxAmount: tax,
            effectiveRate: safeBaseValue > 0 ? tax / safeBaseValue : 0,
            legalText: 'Lei Estadual 14.941/2003. Alíquota Fixa de 5% (Causa Mortis).',
            discountApplied,
            warningMessage,
            originalTaxAmount: originalTax,
            discountValue
        };
    }
};