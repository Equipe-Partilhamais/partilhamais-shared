import { ItcdCalculationMemory } from '../../types';
export interface BracketUnitInfo {
    name: string;
    value: number;
    vigenciaInicio?: string;
}
export declare const calculateMarginalTax: (value: number, brackets: {
    limit: number;
    rate: number;
}[], unitInfo?: BracketUnitInfo) => {
    totalTax: number;
    memory: ItcdCalculationMemory[];
};
export declare const calculateSimpleProgressiveTax: (value: number, brackets: {
    limit: number;
    rate: number;
}[], unitInfo?: BracketUnitInfo) => {
    totalTax: number;
    memory: ItcdCalculationMemory[];
};
/**
 * Linha de conversão/enquadramento em unidade fiscal. Não gera imposto — `tax` fica em 0 para
 * não poluir a soma da coluna "Imposto", e o número em unidades vai em `valueInUnits`.
 */
export declare const buildConversionStep: (rangeLabel: string, baseInReais: number, valueInUnits: number, unitInfo: BracketUnitInfo) => ItcdCalculationMemory;
