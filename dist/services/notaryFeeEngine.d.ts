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
    status: 'CALCULATED' | 'TABLES_UNAVAILABLE' | 'INVALID_TABLE';
}
/** Pure canonical engine used by both frontend and backend. */
export declare const calculateNotaryFees: (uf: string, value: number, tables?: Record<string, NotaryFeeRange[]>, metadata?: Record<string, NotaryFeeMetadata>) => NotaryFeeResult;
