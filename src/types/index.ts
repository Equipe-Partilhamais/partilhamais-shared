// Tipos mínimos compartilhados pelo engine de cálculo (extraídos do frontend).
export type UF =
  | 'AC' | 'AL' | 'AP' | 'AM' | 'BA' | 'CE' | 'DF' | 'ES' | 'GO' | 'MA'
  | 'MT' | 'MS' | 'MG' | 'PA' | 'PB' | 'PR' | 'PE' | 'PI' | 'RJ' | 'RN'
  | 'RS' | 'RO' | 'RR' | 'SC' | 'SP' | 'SE' | 'TO';

export interface ItcdCalculationMemory {
  rangeLabel: string;
  /** SEMPRE em reais. O valor na unidade fiscal vai em `valueInUnits`. */
  base: number;
  rate: number;
  /** SEMPRE em reais. A soma da coluna tem de fechar com `taxAmount`. */
  tax: number;
  isFiscalUnit?: boolean;
  unitValue?: number;
  unitName?: string;
  /** Base da linha expressa na unidade fiscal (UFIR/UPF/UFIRCE/UFEMG). */
  valueInUnits?: number;
  /** Vigência do valor da unidade fiscal usada nesta linha (AAAA-MM-DD). */
  unitVigencia?: string;
  /** Linha de conversão/enquadramento: não gera imposto, `tax` é sempre 0. */
  isConversionStep?: boolean;
}
