
import { ItcdCalculationMemory } from '../../types';

export type ItcdTaxType = 'CAUSA_MORTIS' | 'DOACAO';

/**
 * HOMOLOGADA: alíquota/faixa conferida contra a lei estadual vigente.
 * NAO_CONFIGURADA: o número é apenas referencial e NÃO pode ser apresentado como oficial.
 */
export type ItcdReliability = 'HOMOLOGADA' | 'NAO_CONFIGURADA';

export interface ItcdFiscalUnitUsed {
    name: string;
    value: number;
    /** Início da vigência do valor usado (AAAA-MM-DD), resolvido pela data do fato gerador. */
    vigenciaInicio?: string;
    source?: string;
    /** A série não cobre a data do fato gerador; o valor é o último conhecido. */
    outdated?: boolean;
    /**
     * O índice foi conferido na SEFAZ estadual? Independe de `outdated`: um valor pode
     * cobrir a data do fato gerador e mesmo assim nunca ter sido conferido, que é a
     * situação de TODAS as séries hoje.
     */
    conferida?: boolean;
}

export interface ItcdResult {
    taxAmount: number;
    effectiveRate: number;
    legalText: string;
    discountApplied?: string;
    warningMessage?: string;
    originalTaxAmount?: number;
    discountValue?: number;
    calculationMemory?: ItcdCalculationMemory[];
    fiscalUnitUsed?: ItcdFiscalUnitUsed;
    /**
     * Carimbo de confiabilidade do resultado. Preenchido centralmente por
     * `calculateItcdForState`; quem exibir o valor é obrigado a ler este campo antes de
     * apresentá-lo como imposto devido.
     */
    confiabilidade?: ItcdReliability;
    /** O que falta homologar nesta UF/tipo de fato gerador. Só vem quando NAO_CONFIGURADA. */
    pendenciaHomologacao?: string;
}

export interface ItcdStrategyParams {
    baseValue: number;
    deathDate?: string;
    taxType: ItcdTaxType; // Novo campo obrigatório
    settings?: {
        applyInventoryDiscount: boolean;
    };
}

export interface ItcdStrategy {
    calculate(params: ItcdStrategyParams): ItcdResult;
}
