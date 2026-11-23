import {
  Asset,
  AssetDebtDeductionSummary,
  EstateSettlementItem,
  Liability,
  LiabilityDistributionCriterion,
  LiabilityPartitionTreatment,
  LiabilityReportEntry,
} from './enums';
import { AssetValuationBasis, getAssetEffectiveValue } from './frontend.assetValuation';

export type AssumedHeirDebt = {
  liabilityId: string;
  personId: string;
  description: string;
  value: number;
  escrituraObservation?: string;
};

export const normalizeLiability = (liability: Liability): Liability => {
  const inferredTreatment =
    liability.partitionTreatment ||
    (liability.responsibleHeirId ? LiabilityPartitionTreatment.HERDEIRO_TORNA : undefined) ||
    (liability.paymentMode === 'HEIRS' ? LiabilityPartitionTreatment.HERDEIRO_TORNA : undefined) ||
    (liability.paymentMode === 'ESTATE' ? LiabilityPartitionTreatment.ESPOLIO : undefined) ||
    ((liability.assetLinks?.length || 0) > 0 ? LiabilityPartitionTreatment.BEM_VINCULADO : undefined) ||
    LiabilityPartitionTreatment.ESPOLIO;

  return {
    ...liability,
    partitionTreatment: inferredTreatment,
    distributionCriterion: liability.distributionCriterion || LiabilityDistributionCriterion.PROPORCIONAL,
    assetLinks: (liability.assetLinks || [])
      .filter(link => !!link.assetId && Number.isFinite(link.deductedValue) && link.deductedValue > 0)
      .map(link => ({
        assetId: link.assetId,
        deductedValue: Number(link.deductedValue),
      })),
  };
};

export const buildAssetDebtSummary = (
  assets: Asset[],
  liabilities: Liability[],
  basis: AssetValuationBasis,
): AssetDebtDeductionSummary[] => {
  const normalizedLiabilities = liabilities.map(normalizeLiability);

  return assets.map(asset => {
    const grossValue = getAssetEffectiveValue(asset, basis);
    const linkedLiabilities = normalizedLiabilities
      .filter(liability => liability.partitionTreatment === LiabilityPartitionTreatment.BEM_VINCULADO)
      .flatMap(liability =>
        (liability.assetLinks || [])
          .filter(link => link.assetId === asset.id)
          .map(link => ({
            liabilityId: liability.id,
            description: liability.description,
            deductedValue: link.deductedValue,
            criterion: liability.distributionCriterion,
          })),
      );

    const deductedValue = linkedLiabilities.reduce((sum, link) => sum + link.deductedValue, 0);

    return {
      assetId: asset.id,
      grossValue,
      deductedValue,
      netValue: grossValue - deductedValue,
      liabilities: linkedLiabilities,
    };
  });
};

export const buildAssetDebtSummaryMap = (
  assets: Asset[],
  liabilities: Liability[],
  basis: AssetValuationBasis,
): Map<string, AssetDebtDeductionSummary> => {
  return new Map(buildAssetDebtSummary(assets, liabilities, basis).map(item => [item.assetId, item]));
};

export const getNetAssetValue = (
  asset: Asset,
  summaryMap: Map<string, AssetDebtDeductionSummary>,
  basis: AssetValuationBasis,
) => {
  return summaryMap.get(asset.id)?.netValue ?? getAssetEffectiveValue(asset, basis);
};

export const buildEstateSettlementItems = (liabilities: Liability[]): EstateSettlementItem[] => {
  return liabilities
    .map(normalizeLiability)
    .filter(liability => liability.partitionTreatment === LiabilityPartitionTreatment.ESPOLIO)
    .map(liability => ({
      id: `settlement-${liability.id}`,
      liabilityId: liability.id,
      description: `Quitacao de passivo - ${liability.description}`,
      value: -Math.abs(liability.value || 0),
      assetIds: (liability.assetLinks || []).map(link => link.assetId),
    }));
};

export const buildAssumedHeirDebts = (liabilities: Liability[]): AssumedHeirDebt[] => {
  return liabilities
    .map(normalizeLiability)
    .filter(
      liability =>
        liability.partitionTreatment === LiabilityPartitionTreatment.HERDEIRO_TORNA &&
        !!liability.responsibleHeirId &&
        (liability.value || 0) > 0,
    )
    .map(liability => ({
      liabilityId: liability.id,
      personId: liability.responsibleHeirId!,
      description: liability.description,
      value: liability.value,
      escrituraObservation: liability.escrituraObservation,
    }));
};

export const buildLiabilityReport = (liabilities: Liability[]): LiabilityReportEntry[] => {
  return liabilities.map(rawLiability => {
    const liability = normalizeLiability(rawLiability);
    return {
      liabilityId: liability.id,
      description: liability.description,
      value: liability.value,
      treatment: liability.partitionTreatment,
      criterion: liability.distributionCriterion,
      responsibleHeirId: liability.responsibleHeirId,
      escrituraObservation: liability.escrituraObservation,
      assetLinks: (liability.assetLinks || []).map(link => ({
        assetId: link.assetId,
        deductedValue: link.deductedValue,
      })),
    };
  });
};
