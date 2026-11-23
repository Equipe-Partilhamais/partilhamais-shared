import { UF } from '../../types';
import { ItcdCompetenceInfo, ItcdCompetenceRule, PartitionAssetInput, PartitionDeceasedInput, PartitionSettingsInput } from './tipos';
export declare const ITCD_COMPETENCE_RULES: Record<ItcdCompetenceRule, ItcdCompetenceInfo>;
export declare const isForeignConnectionRule: (rule: ItcdCompetenceRule) => boolean;
/** Bem no exterior por `location` (imóveis) ou `otherDetails.locationType`. */
export declare const isAssetAbroad: (asset: Pick<PartitionAssetInput, "location" | "otherDetails">) => boolean;
export interface AssetItcdCompetence {
    /** Estado usado no cálculo. Quando `indeterminada`, é a UF do processo e só uma estimativa. */
    state: UF;
    competence: ItcdCompetenceInfo;
    /** CALC-03: o dado que define a competência não foi informado. */
    indeterminada: boolean;
    /**
     * De cujus domiciliado no exterior: a competência é do domicílio de CADA sucessor (LC 227/2026,
     * arts. 158, III, e 159, II). O motor apura o ITCD deste bem por sucessor, pela UF de residência de
     * cada herdeiro; `state` aqui é só a UF de referência para listagem (a informada no falecido ou
     * a do processo) e NÃO é onde o imposto é devido.
     */
    porSucessor: boolean;
    warning?: string;
}
type CompetenceAsset = Pick<PartitionAssetInput, 'type' | 'state' | 'location' | 'otherDetails'>;
type CompetenceDeceased = Pick<PartitionDeceasedInput, 'deathDate' | 'lastResidenceState' | 'domiciledAbroad' | 'successorDomicileState'>;
type CompetenceSettings = Pick<PartitionSettingsInput, 'selectedState'>;
export declare const resolveAssetItcdCompetence: (asset: CompetenceAsset, deceased: CompetenceDeceased, settings: CompetenceSettings) => AssetItcdCompetence;
export declare const resolveAssetItcdState: (asset: CompetenceAsset, deceased: CompetenceDeceased, settings: CompetenceSettings) => UF;
export {};
