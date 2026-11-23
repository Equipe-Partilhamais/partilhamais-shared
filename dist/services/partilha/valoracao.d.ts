import { AssetDebtDeductionSummary, AssetValuationBasis, LiabilityDistributionCriterion, LiabilityPartitionTreatment, LiabilityReportEntry, PartitionAssetInput, PartitionLiabilityInput, PartitionSettingsInput } from './tipos';
export declare const resolveAssetValuationBasis: (settings?: Pick<PartitionSettingsInput, "assetValuationBasis"> | null) => AssetValuationBasis;
export declare const getAssetGrossValue: (asset: Pick<PartitionAssetInput, "marketValue" | "stateAssessedValue" | "otherDetails">, basis: AssetValuationBasis) => number;
/** Valor do bem na base escolhida, aplicado o percentual de titularidade (ausente = 100%). */
export declare const getAssetEffectiveValue: (asset: Pick<PartitionAssetInput, "marketValue" | "stateAssessedValue" | "otherDetails" | "ownershipPercentage">, basis: AssetValuationBasis) => number;
export interface NormalizedLiability extends PartitionLiabilityInput {
    partitionTreatment: LiabilityPartitionTreatment;
    distributionCriterion: LiabilityDistributionCriterion;
    assetLinks: Array<{
        assetId: string;
        deductedValue: number;
    }>;
    /** RECONCILIADO: o backend já caía em 'Dívida' quando a descrição vinha vazia. */
    description: string;
}
export declare const normalizeLiability: (liability: PartitionLiabilityInput) => NormalizedLiability;
/** Abatimento das dívidas BEM_VINCULADO, bem a bem. `getGross` já vem com a base e a titularidade. */
export declare const buildAssetDebtSummary: (assets: PartitionAssetInput[], liabilities: NormalizedLiability[], getGross: (asset: PartitionAssetInput) => number) => AssetDebtDeductionSummary[];
export interface AssumedHeirDebt {
    liabilityId: string;
    personId: string;
    description: string;
    value: number;
    escrituraObservation?: string;
}
export declare const buildAssumedHeirDebts: (liabilities: NormalizedLiability[]) => AssumedHeirDebt[];
export declare const buildLiabilityReport: (liabilities: NormalizedLiability[]) => LiabilityReportEntry[];
