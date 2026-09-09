export type SuccessionHeirType = 'CONJUGE' | 'DESCENDENTE' | 'ASCENDENTE' | 'COLATERAL' | 'TESTAMENTARIO' | 'OUTROS';
export type SuccessionHeirSubtype = 'FILHO' | 'FILHO_UNILATERAL' | 'NETO' | 'PAI' | 'AVO' | 'IRMAO' | 'SOBRINHO' | 'TESTAMENTARIO' | 'OUTRO';
export type SuccessionMaritalRegime = 'COMUNHAO_UNIVERSAL' | 'COMUNHAO_PARCIAL' | 'SEPARACAO_TOTAL' | 'SEPARACAO_OBRIGATORIA' | 'SOLTEIRO' | 'UNIAO_ESTAVEL';
export type SuccessionExclusion = 'RENUNCIA' | 'INDIGNIDADE' | 'DESERDACAO';
export type SuccessionHeir = {
    id: string;
    name: string;
    type: SuccessionHeirType;
    subtype?: SuccessionHeirSubtype;
    isPreDeceased?: boolean;
    parentId?: string;
    testamentaryMode?: 'PERCENTAGE_OF_ESTATE' | 'SPECIFIC_ASSETS';
    testamentaryPercentage?: number;
    successionExclusion?: SuccessionExclusion;
    ascendantLine?: 'PATERNA' | 'MATERNA';
    siblingBond?: 'BILATERAL' | 'UNILATERAL';
};
export type StirpeMember = {
    heir: SuccessionHeir;
    weight: number;
};
export declare const isRenouncer: (h: SuccessionHeir) => boolean;
export declare const isExcludedFromSuccession: (h: SuccessionHeir) => boolean;
export declare const inheritsInOwnRight: (h: SuccessionHeir) => boolean;
export declare const shouldSpouseCompeteWithDescendants: (regime: SuccessionMaritalRegime, hasPrivateAssets: boolean) => boolean;
export declare const spouseShareWithAscendants: (degree: number, ascCount: number) => number;
export declare const ascendantDegree: (h: SuccessionHeir) => number;
export declare const callAscendants: (ascendants: SuccessionHeir[]) => {
    degree: number;
    called: SuccessionHeir[];
};
export declare const splitAmongAscendants: (called: SuccessionHeir[], amount: number) => Map<string, number>;
export declare const MAX_REPRESENTATION_DEPTH = 12;
/**
 * Arts. 1.851/1.852: na linha reta descendente a representação desce sempre, sem
 * limite de grau. Art. 1.855: o quinhão do representado divide-se entre os
 * representantes DELE (por estirpe), não por cabeça no monte.
 */
export declare const resolveRepresentatives: (heirs: SuccessionHeir[], represented: SuccessionHeir, visited: Set<string>, depth: number) => StirpeMember[];
/** Estirpes dos descendentes, já com a representação resolvida. */
export declare const buildDescendantSharesWithRepresentation: (heirs: SuccessionHeir[]) => {
    stirpes: {
        childId: string;
        members: StirpeMember[];
    }[];
};
export declare const collateralDegree: (h: SuccessionHeir) => number;
export declare const siblingQuota: (h?: SuccessionHeir) => number;
export declare const buildCollateralShares: (collaterals: SuccessionHeir[]) => StirpeMember[];
export declare const inofficiousReductionFactors: (dispositions: {
    kind: "QUOTA" | "LEGADO";
    value: number;
}[], disposableLimit: number) => {
    quota: number;
    legacy: number;
};
export declare const ITCD_COMPETENCE_CHANGE_DATE = "2023-12-20";
export declare const isPreCompetenceChangeDeath: (deathDate?: string) => boolean;
export declare const getCommonEstateFactor: (regime: SuccessionMaritalRegime, hasSpouse: boolean) => number;
export declare const getPrivateEstateFactor: (regime: SuccessionMaritalRegime, hasSpouse: boolean) => number;
/** Rateia o passivo do espólio entre as UFs proporcionalmente ao acervo de cada uma. */
export declare const allocateDebtByState: <K>(valuesByState: Map<K, number>, totalDebt: number) => Map<K, number>;
