// Enums dos dois apps (idênticos no front e no back), para as cópias legadas compilarem aqui.
export enum MaritalRegime {
    COMUNHAO_UNIVERSAL = 'COMUNHAO_UNIVERSAL',
    COMUNHAO_PARCIAL = 'COMUNHAO_PARCIAL',
    SEPARACAO_TOTAL = 'SEPARACAO_TOTAL',
    SEPARACAO_OBRIGATORIA = 'SEPARACAO_OBRIGATORIA',
    SOLTEIRO = 'SOLTEIRO',
    UNIAO_ESTAVEL = 'UNIAO_ESTAVEL',
}

export enum AssetType {
    IMOVEL = 'IMOVEL',
    MOVEL = 'MOVEL',
    FINANCEIRO = 'FINANCEIRO',
    OUTROS = 'OUTROS',
    ADIANTAMENTO = 'ADIANTAMENTO',
}

export enum AssetOrigin {
    PARTICULAR = 'PARTICULAR',
    COMUM = 'COMUM',
}

export enum HeirType {
    CONJUGE = 'CONJUGE',
    DESCENDENTE = 'DESCENDENTE',
    ASCENDENTE = 'ASCENDENTE',
    COLATERAL = 'COLATERAL',
    TESTAMENTARIO = 'TESTAMENTARIO',
    OUTROS = 'OUTROS',
}

export enum LiabilityPartitionTreatment {
    ESPOLIO = 'ESPOLIO',
    BEM_VINCULADO = 'BEM_VINCULADO',
    HERDEIRO_TORNA = 'HERDEIRO_TORNA',
}

export enum LiabilityDistributionCriterion {
    PROPORCIONAL = 'PROPORCIONAL',
    IGUALITARIA = 'IGUALITARIA',
    CONCENTRADA = 'CONCENTRADA',
    MANUAL = 'MANUAL',
}

export type UF = import('../../../types').UF;
export type AssetValuationBasis = 'MARKET' | 'STATE';
export type ItcdTaxType = 'CAUSA_MORTIS' | 'DOACAO';

// Os tipos de dados dos apps são largos (dezenas de campos de UI). Para a caracterização
// basta o formato que o motor lê; `any` aqui é deliberado — o legado não é código de produção.
export interface InventoryState {
    deceased: any;
    assets: any[];
    liabilities: any[];
    heirs: any[];
    settings: any;
    feeTables?: any;
    feeMetadata?: any;
    [campo: string]: any;
}
export type InventoryStateForCalculation = InventoryState;
export type CalculationResult = any;
export type AllocationTarget = any;
export type DonationEvent = any;
export type ItcdCompetenceRule = string;
export type ItcdCompetenceInfo = { rule: string; label: string; legalRef: string };
export type Settings = any;
export type Asset = any;
export type Liability = any;
export type AssetDebtDeductionSummary = any;
export type EstateSettlementItem = any;
export type LiabilityReportEntry = any;
