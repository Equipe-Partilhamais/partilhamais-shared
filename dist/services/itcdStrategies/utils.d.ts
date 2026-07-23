export declare const calculateMarginalTax: (value: number, brackets: {
    limit: number;
    rate: number;
}[], unitInfo?: {
    name: string;
    value: number;
}) => {
    totalTax: number;
    memory: any[];
};
export declare const calculateSimpleProgressiveTax: (value: number, brackets: {
    limit: number;
    rate: number;
}[], unitInfo?: {
    name: string;
    value: number;
}) => {
    totalTax: number;
    memory: any[];
};
