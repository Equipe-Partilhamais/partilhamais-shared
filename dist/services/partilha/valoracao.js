"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildLiabilityReport = exports.buildAssumedHeirDebts = exports.buildAssetDebtSummary = exports.normalizeLiability = exports.getAssetEffectiveValue = exports.getAssetGrossValue = exports.resolveAssetValuationBasis = void 0;
// Valoração dos bens e normalização do passivo — eram `utils/assetValuation.ts` e
// `utils/liabilityPartition.ts` no frontend e uma cópia inline no backend.
//
// RECONCILIADO (CALC-09): o backend só lia o valor fiscal em `otherDetails.stateAssessedValue`;
// o frontend lia também `stateAssessedValue` no topo do bem, onde o formulário o grava. Com a
// base "valor fiscal" escolhida, o backend caía no valor de mercado em silêncio. Vale a versão
// do frontend (lê os dois, topo primeiro).
const resolveAssetValuationBasis = (settings) => settings?.assetValuationBasis === 'STATE' ? 'STATE' : 'MARKET';
exports.resolveAssetValuationBasis = resolveAssetValuationBasis;
const positiveFinite = (value) => typeof value === 'number' && Number.isFinite(value) && value > 0;
const getStateAssessedValue = (asset) => {
    if (positiveFinite(asset.stateAssessedValue))
        return asset.stateAssessedValue;
    const nested = asset.otherDetails?.stateAssessedValue;
    if (positiveFinite(nested))
        return nested;
    return undefined;
};
const getAssetGrossValue = (asset, basis) => {
    if (basis === 'STATE') {
        const stateValue = getStateAssessedValue(asset);
        if (typeof stateValue === 'number')
            return stateValue;
    }
    return asset.marketValue || 0;
};
exports.getAssetGrossValue = getAssetGrossValue;
/** Valor do bem na base escolhida, aplicado o percentual de titularidade (ausente = 100%). */
const getAssetEffectiveValue = (asset, basis) => {
    const ownership = asset.ownershipPercentage !== undefined && asset.ownershipPercentage !== null ? asset.ownershipPercentage : 100;
    return (0, exports.getAssetGrossValue)(asset, basis) * (ownership / 100);
};
exports.getAssetEffectiveValue = getAssetEffectiveValue;
const normalizeLiability = (liability) => {
    const partitionTreatment = liability.partitionTreatment ||
        (liability.responsibleHeirId ? 'HERDEIRO_TORNA' : undefined) ||
        (liability.paymentMode === 'HEIRS' ? 'HERDEIRO_TORNA' : undefined) ||
        (liability.paymentMode === 'ESTATE' ? 'ESPOLIO' : undefined) ||
        ((liability.assetLinks?.length || 0) > 0 ? 'BEM_VINCULADO' : undefined) ||
        'ESPOLIO';
    return {
        ...liability,
        description: liability.description || 'Dívida',
        partitionTreatment,
        distributionCriterion: liability.distributionCriterion || 'PROPORCIONAL',
        assetLinks: (liability.assetLinks || [])
            .filter(link => !!link.assetId && Number.isFinite(link.deductedValue) && link.deductedValue > 0)
            .map(link => ({ assetId: link.assetId, deductedValue: Number(link.deductedValue) })),
    };
};
exports.normalizeLiability = normalizeLiability;
/** Abatimento das dívidas BEM_VINCULADO, bem a bem. `getGross` já vem com a base e a titularidade. */
const buildAssetDebtSummary = (assets, liabilities, getGross) => {
    const linked = liabilities.filter(l => l.partitionTreatment === 'BEM_VINCULADO');
    return assets.map(asset => {
        const grossValue = getGross(asset);
        const links = linked.flatMap(liability => liability.assetLinks
            .filter(link => link.assetId === asset.id)
            .map(link => ({
            liabilityId: liability.id,
            description: liability.description,
            deductedValue: link.deductedValue,
            criterion: liability.distributionCriterion,
        })));
        const deductedValue = links.reduce((sum, link) => sum + link.deductedValue, 0);
        return { assetId: asset.id, grossValue, deductedValue, netValue: grossValue - deductedValue, liabilities: links };
    });
};
exports.buildAssetDebtSummary = buildAssetDebtSummary;
const buildAssumedHeirDebts = (liabilities) => liabilities
    .filter(l => l.partitionTreatment === 'HERDEIRO_TORNA' && !!l.responsibleHeirId && (l.value || 0) > 0)
    .map(l => ({
    liabilityId: l.id,
    personId: l.responsibleHeirId,
    description: l.description,
    value: l.value,
    escrituraObservation: l.escrituraObservation ?? undefined,
}));
exports.buildAssumedHeirDebts = buildAssumedHeirDebts;
const buildLiabilityReport = (liabilities) => liabilities.map(l => ({
    liabilityId: l.id,
    description: l.description,
    value: l.value,
    treatment: l.partitionTreatment,
    criterion: l.distributionCriterion,
    responsibleHeirId: l.responsibleHeirId ?? undefined,
    escrituraObservation: l.escrituraObservation ?? undefined,
    assetLinks: l.assetLinks.map(link => ({ assetId: link.assetId, deductedValue: link.deductedValue })),
}));
exports.buildLiabilityReport = buildLiabilityReport;
