export interface FiscalUnit {
    id: string;
    name: string;
    value: number;
    lastUpdate: string;
    description: string;
}
export declare const fiscalUnitsApi: {
    getUnit: (uf: string) => FiscalUnit | null;
    getAllUnits: () => FiscalUnit[];
    refreshRates: () => Promise<boolean>;
};
