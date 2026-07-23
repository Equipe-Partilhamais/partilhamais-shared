// Tipos mínimos compartilhados pelo engine de cálculo (extraídos do frontend).
export type UF =
  | 'AC' | 'AL' | 'AP' | 'AM' | 'BA' | 'CE' | 'DF' | 'ES' | 'GO' | 'MA'
  | 'MT' | 'MS' | 'MG' | 'PA' | 'PB' | 'PR' | 'PE' | 'PI' | 'RJ' | 'RN'
  | 'RS' | 'RO' | 'RR' | 'SC' | 'SP' | 'SE' | 'TO';

export interface ItcdCalculationMemory {
  rangeLabel: string;
  base: number;
  rate: number;
  tax: number;
  isFiscalUnit?: boolean;
  unitValue?: number;
  unitName?: string;
  valueInUnits?: number;
}
