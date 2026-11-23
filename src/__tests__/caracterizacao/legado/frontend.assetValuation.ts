import { Settings } from './enums';

export type AssetValuationBasis = 'MARKET' | 'STATE';

type AssetLike = {
  marketValue?: number;
  stateAssessedValue?: number;
  ownershipPercentage?: number;
  otherDetails?: {
    stateAssessedValue?: number;
  };
};

export const resolveAssetValuationBasis = (settings?: Partial<Settings> | null): AssetValuationBasis => {
  return settings?.assetValuationBasis === 'STATE' ? 'STATE' : 'MARKET';
};

const getStateAssessedValue = (asset: AssetLike): number | undefined => {
  const direct = asset.stateAssessedValue;
  if (typeof direct === 'number' && Number.isFinite(direct) && direct > 0) return direct;

  const nested = asset.otherDetails?.stateAssessedValue;
  if (typeof nested === 'number' && Number.isFinite(nested) && nested > 0) return nested;

  return undefined;
};

export const getAssetGrossValue = (asset: AssetLike, basis: AssetValuationBasis): number => {
  if (basis === 'STATE') {
    const stateVal = getStateAssessedValue(asset);
    if (typeof stateVal === 'number') return stateVal;
  }
  return asset.marketValue || 0;
};

export const getAssetEffectiveValue = (asset: AssetLike, basis: AssetValuationBasis): number => {
  const ownershipPct = (asset.ownershipPercentage !== undefined && asset.ownershipPercentage !== null)
    ? asset.ownershipPercentage
    : 100;

  return getAssetGrossValue(asset, basis) * (ownershipPct / 100);
};
