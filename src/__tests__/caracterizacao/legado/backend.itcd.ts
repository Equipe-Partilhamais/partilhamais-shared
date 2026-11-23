/**
 * Backend adapter for the canonical ITCD engine.
 *
 * The state strategies live in the frontend package because that is the
 * original, validated implementation. Both runtimes execute the same source
 * so rates, brackets, discounts and fiscal-unit rules cannot drift.
 */
import {
    calculateItcdForState as calculateCanonicalItcd,
    ItcdResult as CanonicalItcdResult,
} from './nucleoCongelado';
import { UF, ItcdTaxType } from './enums';

interface ItcdSettings {
    applyInventoryDiscount?: boolean;
}

// O retorno é o tipo canônico (superset de lib/types.ItcdResult): carrega `confiabilidade`,
// `pendenciaHomologacao` e a vigência da unidade fiscal. Truncar para o tipo local jogaria
// fora justamente a ressalva que impede o valor de ser apresentado como oficial.
export function calculateItcdForState(
    uf: UF,
    baseValue: number,
    settings?: ItcdSettings,
    deathDate?: string,
    taxType: ItcdTaxType = 'CAUSA_MORTIS'
): CanonicalItcdResult {
    return calculateCanonicalItcd(
        uf,
        baseValue,
        { applyInventoryDiscount: settings?.applyInventoryDiscount ?? false },
        deathDate,
        taxType
    );
}
