export interface NotaryFeeRange {
    min: number;
    max: number | null;
    deed: number;
    registry: number;
}
export interface NotaryFeeMetadata {
    source: string;
    lastUpdate: string;
    hasFundsIncluded: boolean;
}
export interface NotaryFeeResult {
    deed: number;
    registry: number;
    rangeLabel: string;
    isFallback: boolean;
    /**
     * CALCULATED é o ÚNICO status em que `deed`/`registry` são valores. Nos demais eles são 0
     * porque não houve cálculo — exibir "R$ 0,00" nesse caso é apresentar ausência de dado como
     * emolumento devido. Quem consome tem de checar o status antes de formatar.
     */
    status: 'CALCULATED' | 'TABLES_UNAVAILABLE' | 'INVALID_TABLE';
    /** Fonte da tabela usada (metadata da UF ou DEFAULT). */
    source?: string;
    /** Ano/competência da tabela usada — serve de ressalva de desatualização. */
    lastUpdate?: string;
    /** Margem de segurança aplicada sobre os emolumentos tabelados. */
    safetyMargin?: number;
}
/** Pure canonical engine used by both frontend and backend. */
export declare const calculateNotaryFees: (uf: string, value: number, tables?: Record<string, NotaryFeeRange[]>, metadata?: Record<string, NotaryFeeMetadata>) => NotaryFeeResult;
