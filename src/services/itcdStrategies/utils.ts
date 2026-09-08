
import { formatCurrency } from '../../utils/formatters';
import { ItcdCalculationMemory } from '../../types';

// As constantes fiscais agora vêm de services/fiscalUnitsApi.ts
// Este arquivo mantém apenas a lógica matemática pura

export interface BracketUnitInfo {
    name: string;
    value: number;
    vigenciaInicio?: string;
}

// A memória de cálculo é lida por telas e pelo DOCX entregue ao cliente, que formatam `base` e
// `tax` com formatCurrency(). Por isso as linhas saem SEMPRE em reais; a expressão na unidade
// fiscal fica em `valueInUnits`/`rangeLabel`. Sem isso a coluna "Imposto" não fecha com o total.
const buildBracketMemory = (
    rangeLabel: string,
    amountInTableCurrency: number,
    rate: number,
    taxInTableCurrency: number,
    unitInfo?: BracketUnitInfo
): ItcdCalculationMemory => ({
    rangeLabel,
    base: unitInfo ? amountInTableCurrency * unitInfo.value : amountInTableCurrency,
    rate,
    tax: unitInfo ? taxInTableCurrency * unitInfo.value : taxInTableCurrency,
    isFiscalUnit: !!unitInfo,
    unitName: unitInfo?.name,
    unitValue: unitInfo?.value,
    valueInUnits: unitInfo ? amountInTableCurrency : undefined,
    unitVigencia: unitInfo?.vigenciaInicio,
});

// Helper: Cálculo de Tabela Progressiva Marginal (Por Faixas/Parcelas - Ex: DF, SC, RS, Federal)
// Aceita valores em R$ ou Unidades Fiscais. Se unitValue for passado, converte os labels.
export const calculateMarginalTax = (value: number, brackets: { limit: number, rate: number }[], unitInfo?: BracketUnitInfo): { totalTax: number, memory: ItcdCalculationMemory[] } => {
    let totalTax = 0;
    let previousLimit = 0;
    const memory: ItcdCalculationMemory[] = [];

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

                memory.push(buildBracketMemory(rangeLabel, taxableAmount, bracket.rate, tax, unitInfo));
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
export const calculateSimpleProgressiveTax = (value: number, brackets: { limit: number, rate: number }[], unitInfo?: BracketUnitInfo): { totalTax: number, memory: ItcdCalculationMemory[] } => {
    // Encontrar a faixa de enquadramento
    const targetBracket = brackets.find(b => value <= b.limit) || brackets[brackets.length - 1];

    const totalTax = value * targetBracket.rate;

    // Memória simplificada
    const formatValue = (val: number) => {
        if (unitInfo) return `${(val || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} ${unitInfo.name}`;
        return formatCurrency(val);
    };

    const memory = [
        buildBracketMemory(
            `Enquadramento (Base Total: ${formatValue(value)})`,
            value,
            targetBracket.rate,
            totalTax,
            unitInfo
        ),
    ];

    return { totalTax, memory };
};

/**
 * Linha de conversão/enquadramento em unidade fiscal. Não gera imposto — `tax` fica em 0 para
 * não poluir a soma da coluna "Imposto", e o número em unidades vai em `valueInUnits`.
 */
export const buildConversionStep = (
    rangeLabel: string,
    baseInReais: number,
    valueInUnits: number,
    unitInfo: BracketUnitInfo
): ItcdCalculationMemory => ({
    rangeLabel,
    base: baseInReais,
    rate: 0,
    tax: 0,
    isFiscalUnit: true,
    unitName: unitInfo.name,
    unitValue: unitInfo.value,
    valueInUnits,
    unitVigencia: unitInfo.vigenciaInicio,
    isConversionStep: true,
});
