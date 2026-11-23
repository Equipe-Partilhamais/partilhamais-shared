import { ItcdCalculationMemory, UF } from '../../types';
import { ItcdFiscalUnitUsed, ItcdReliability, ItcdResult, ItcdTaxType } from '../itcdStrategies/types';
import { BaseDeCalculoItcd, PerfilItcdUf } from '../itcdStrategies/perfilUf';
import { SuccessionHeirType } from '../successionCore';
export interface PesoBeneficiario {
    personId: string;
    personName: string;
    personType: SuccessionHeirType;
    /** Parte deste beneficiário na base da UF (qualquer escala; o rateio normaliza). */
    peso: number;
}
export interface ItcdBeneficiarioUf {
    personId: string;
    personName: string;
    personType: SuccessionHeirType;
    /** Base deste beneficiário na UF, em reais com centavos exatos. */
    base: number;
    /** Imposto da guia deste beneficiário, arredondado a centavo (CALC-08). */
    taxAmount: number;
    effectiveRate: number;
    originalTaxAmount: number;
    discountValue: number;
    discountApplied?: string;
    warningMessage?: string;
    calculationMemory: ItcdCalculationMemory[];
}
export interface ItcdUfCalculado {
    state: UF;
    taxBase: number;
    taxAmount: number;
    effectiveRate: number;
    legalText: string;
    discountApplied?: string;
    originalTaxAmount: number;
    discountValue: number;
    warningMessage?: string;
    confiabilidade?: ItcdReliability;
    pendenciaHomologacao?: string;
    calculationMemory: ItcdCalculationMemory[];
    fiscalUnitUsed?: ItcdFiscalUnitUsed;
    baseDeCalculo: BaseDeCalculoItcd;
    fundamentoBaseDeCalculo: string;
    beneficiarios: ItcdBeneficiarioUf[];
    /** Havia base na UF e nenhum beneficiário para ratear: imposto 0 com aviso. */
    semBeneficiarios: boolean;
    /** Revisão (c): vigência registrada da tabela frente à data do fato gerador. */
    vigencia?: 'VIGENTE' | 'ANTERIOR' | 'SEM_DATA';
    vigenciaDesde?: string;
}
/**
 * Resultado de uma estratégia arredondado a centavo (CALC-08), preservando as identidades que
 * o golden do ITCD confere: original − desconto = imposto, e soma da memória = imposto.
 * Exportado para os apps que chamam `calculateItcdForState` fora da partilha.
 */
export declare const arredondarResultadoItcd: (r: ItcdResult) => ItcdResult;
export interface ParametrosItcdDaUf {
    state: UF;
    /** Base total da UF (herança transmitida ali), em centavos. */
    baseCentavos: number;
    pesos: PesoBeneficiario[];
    perfil: PerfilItcdUf;
    settings: {
        applyInventoryDiscount: boolean;
    };
    deathDate?: string;
    taxType: ItcdTaxType;
}
export declare const calcularItcdDaUf: (p: ParametrosItcdDaUf) => ItcdUfCalculado;
