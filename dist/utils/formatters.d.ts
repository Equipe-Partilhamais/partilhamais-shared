export declare const formatCurrency: (value: number | null | undefined) => string;
export declare const formatPercentage: (value: number | null | undefined) => string;
export declare const formatBytes: (bytes: number) => string;
export declare const maskCurrency: (value: string | number | undefined | null) => string;
export declare const parseCurrency: (value: string | undefined | null) => number;
export declare const safeParseFloat: (value: string) => number;
export declare const maskCNPJ: (value: string) => string;
export declare const validateCNPJ: (cnpj: string) => boolean;
