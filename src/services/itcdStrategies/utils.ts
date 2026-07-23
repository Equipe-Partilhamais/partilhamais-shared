
import { formatCurrency } from '../../utils/formatters';

// As constantes fiscais agora vêm de services/fiscalUnitsApi.ts
// Este arquivo mantém apenas a lógica matemática pura

// Helper: Cálculo de Tabela Progressiva Marginal (Por Faixas/Parcelas - Ex: DF, SC, RS, Federal)
// Aceita valores em R$ ou Unidades Fiscais. Se unitValue for passado, converte os labels.
export const calculateMarginalTax = (value: number, brackets: { limit: number, rate: number }[], unitInfo?: { name: string, value: number }): { totalTax: number, memory: any[] } => {
    let totalTax = 0;
    let previousLimit = 0;
    const memory: any[] = [];

    // Se estiver usando unidade fiscal, convertemos o valor de entrada para unidade para o cálculo interno
    // mas a memória deve mostrar a conversão clara
    
    for (let i = 0; i < brackets.length; i++) {
        const bracket = brackets[i];
        
        if (value > previousLimit) {
            const ceiling = bracket.limit === Infinity ? value : bracket.limit;
            const taxableAmount = Math.min(value, ceiling) - previousLimit;
            
            if (taxableAmount > 0) {
                const tax = taxableAmount * bracket.rate;
                totalTax += tax;
                
                let rangeLabel = '';
                
                // Formatação inteligente do label (R$ ou Unidade)
                const formatLimit = (val: number) => {
                    if (val === Infinity) return 'Acima';
                    if (unitInfo) return `${(val || 0).toLocaleString('pt-BR')} ${unitInfo.name}`;
                    return formatCurrency(val);
                };

                const prevStr = formatLimit(previousLimit);
                const limitStr = bracket.limit === Infinity ? '' : formatLimit(bracket.limit);

                if (previousLimit === 0) {
                    rangeLabel = `Até ${limitStr}`;
                } else if (bracket.limit === Infinity) {
                    rangeLabel = `Acima de ${prevStr}`;
                } else {
                    rangeLabel = `De ${prevStr} a ${limitStr}`;
                }

                memory.push({
                    rangeLabel,
                    base: taxableAmount, // Valor na moeda original da tabela (pode ser UPF)
                    rate: bracket.rate,
                    tax: tax, // Imposto na moeda original
                    isFiscalUnit: !!unitInfo,
                    unitName: unitInfo?.name,
                    unitValue: unitInfo?.value
                });
            }
            previousLimit = bracket.limit;
        } else {
            break;
        }
    }
    return { totalTax, memory };
};

// Helper: Cálculo de Progressividade Simples / Não Cumulativa (Ex: MT, AL, CE)
// Aplica a alíquota da faixa final sobre o TOTAL da base.
export const calculateSimpleProgressiveTax = (value: number, brackets: { limit: number, rate: number }[], unitInfo?: { name: string, value: number }): { totalTax: number, memory: any[] } => {
    // Encontrar a faixa de enquadramento
    const targetBracket = brackets.find(b => value <= b.limit) || brackets[brackets.length - 1];
    
    const totalTax = value * targetBracket.rate;
    
    // Memória simplificada
    const formatValue = (val: number) => {
        if (unitInfo) return `${(val || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} ${unitInfo.name}`;
        return formatCurrency(val);
    };

    const memory = [{
        rangeLabel: `Enquadramento (Base Total: ${formatValue(value)})`,
        base: value,
        rate: targetBracket.rate,
        tax: totalTax,
        isFiscalUnit: !!unitInfo,
        unitName: unitInfo?.name,
        unitValue: unitInfo?.value
    }];

    return { totalTax, memory };
};
