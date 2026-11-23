// Núcleo sucessório como os motores legados o viam (shared @ 0499321). Tudo é reexportado
// AO VIVO, menos os dois fatores de meação, que o CALC-02 corrige: aqui ficam como eram.
export {
    allocateDebtByState,
    buildCollateralShares,
    buildDescendantSharesWithRepresentation,
    callAscendants,
    collateralDegree,
    inheritsInOwnRight,
    inofficiousReductionFactors,
    isExcludedFromSuccession,
    isPreCompetenceChangeDeath,
    isRenouncer,
    ITCD_COMPETENCE_CHANGE_DATE,
    shouldSpouseCompeteWithDescendants,
    splitAmongAscendants,
    spouseShareWithAscendants,
} from '../../../services/successionCore';
export type { SuccessionExclusion, SuccessionHeir } from '../../../services/successionCore';
export { calculateItcdForState } from '../../../services/itcdStrategies';
export { calculateNotaryFees } from '../../../services/notaryFeeEngine';
export type { ItcdResult, NotaryFeeResult } from '../../../index';

type Regime = string;

export const getCommonEstateFactor = (regime: Regime, hasSpouse: boolean): number => {
    if (!hasSpouse) return 1;
    if (
        regime === 'COMUNHAO_UNIVERSAL' ||
        regime === 'COMUNHAO_PARCIAL' ||
        regime === 'UNIAO_ESTAVEL' ||
        regime === 'SEPARACAO_OBRIGATORIA'
    ) {
        return 0.5;
    }
    return 1;
};

// Versão anterior ao CALC-02: na comunhão universal metade do PARTICULAR saía do espólio.
export const getPrivateEstateFactor = (regime: Regime, hasSpouse: boolean): number => {
    if (!hasSpouse) return 1;
    if (regime === 'COMUNHAO_UNIVERSAL') {
        return 0.5;
    }
    return 1;
};
