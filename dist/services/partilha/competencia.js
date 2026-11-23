"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveAssetItcdState = exports.resolveAssetItcdCompetence = exports.isAssetAbroad = exports.isForeignConnectionRule = exports.ITCD_COMPETENCE_RULES = void 0;
const successionCore_1 = require("../successionCore");
const warnings_1 = require("../itcdStrategies/warnings");
// Competência (sujeição ativa) do ITCD por bem — art. 155, § 1º, CF; arts. 158/159 da
// LC 227/2026. Era `resolveAssetItcdCompetence` no frontend e uma cópia sem justificativa
// (`resolveAssetItcdState`) no backend.
//
// RECONCILIADO (CALC-09): o backend calculava o mesmo Estado mas descartava a regra e o aviso
// de competência; o ITCD gravado no servidor e as peças geradas lá saíam sem a ressalva que a
// tela mostrava. Vale a versão do frontend, que devolve regra e aviso.
exports.ITCD_COMPETENCE_RULES = {
    IMOVEL_SITUS: {
        rule: 'IMOVEL_SITUS',
        label: 'Imóvel — Estado da situação do bem',
        legalRef: 'Art. 155, §1º, I, CF · art. 158, I, LC 227/2026',
    },
    IMOVEL_EXT_DOMICILIO_TITULAR: {
        rule: 'IMOVEL_EXT_DOMICILIO_TITULAR',
        label: 'Imóvel no exterior — domicílio do de cujus/doador no Brasil',
        legalRef: 'Art. 158, II, LC 227/2026',
    },
    IMOVEL_EXT_DOMICILIO_SUCESSOR: {
        rule: 'IMOVEL_EXT_DOMICILIO_SUCESSOR',
        label: 'Imóvel no exterior — domicílio do sucessor/donatário',
        legalRef: 'Art. 158, III, LC 227/2026',
    },
    MOVEL_DOMICILIO_DE_CUJUS: {
        rule: 'MOVEL_DOMICILIO_DE_CUJUS',
        label: 'Móvel/crédito — domicílio do de cujus',
        legalRef: 'Art. 155, §1º, II, CF (EC 132/2023) · art. 159, I, LC 227/2026',
    },
    MOVEL_EXT_DOMICILIO_SUCESSOR: {
        rule: 'MOVEL_EXT_DOMICILIO_SUCESSOR',
        label: 'Móvel/crédito — de cujus no exterior, domicílio do sucessor',
        legalRef: 'Art. 159, II, LC 227/2026',
    },
    MOVEL_EXT_DOMICILIO_DONATARIO: {
        rule: 'MOVEL_EXT_DOMICILIO_DONATARIO',
        label: 'Móvel/crédito — doador no exterior, domicílio do donatário',
        legalRef: 'Art. 159, IV, LC 227/2026',
    },
    MOVEL_EXT_BEM_NO_BRASIL: {
        rule: 'MOVEL_EXT_BEM_NO_BRASIL',
        label: 'Móvel/crédito — transmitente e recebedor no exterior, bem no Brasil',
        legalRef: 'Art. 159, V, LC 227/2026',
    },
    MOVEL_INVENTARIO_PROCESSO: {
        rule: 'MOVEL_INVENTARIO_PROCESSO',
        label: 'Móvel/crédito — UF do inventário/arrolamento (óbito até 19/12/2023)',
        legalRef: 'Art. 155, §1º, II, CF (redação anterior à EC 132/2023)',
    },
    MOVEL_DOMICILIO_NAO_INFORMADO: {
        rule: 'MOVEL_DOMICILIO_NAO_INFORMADO',
        label: 'Móvel/crédito — domicílio do de cujus NÃO informado: competência indeterminada (UF do processo usada só como estimativa)',
        legalRef: 'Art. 155, §1º, II, CF (EC 132/2023) · art. 159, I, LC 227/2026',
        indeterminada: true,
    },
    IMOVEL_UF_NAO_INFORMADA: {
        rule: 'IMOVEL_UF_NAO_INFORMADA',
        label: 'Imóvel — UF de situação NÃO informada: competência indeterminada (UF do processo usada só como estimativa)',
        legalRef: 'Art. 155, §1º, I, CF · art. 158, I, LC 227/2026',
        indeterminada: true,
    },
    IMOVEL_EXT_DOMICILIO_NAO_INFORMADO: {
        rule: 'IMOVEL_EXT_DOMICILIO_NAO_INFORMADO',
        label: 'Imóvel no exterior — domicílio do de cujus NÃO informado: competência indeterminada (UF do processo usada só como estimativa)',
        legalRef: 'Art. 158, II, LC 227/2026',
        indeterminada: true,
    },
    SUCESSOR_DOMICILIO_NAO_INFORMADO: {
        rule: 'SUCESSOR_DOMICILIO_NAO_INFORMADO',
        label: 'De cujus no exterior — domicílio do sucessor NÃO informado: competência indeterminada (UF do processo usada só como estimativa)',
        legalRef: 'Arts. 158, III, e 159, II, LC 227/2026',
        indeterminada: true,
    },
};
// Regras que dependem de elemento de conexão no exterior (Tema 825/STF): a cobrança efetiva
// exige lei estadual/distrital válida e as anterioridades.
const FOREIGN_CONNECTION_RULES = new Set([
    'IMOVEL_EXT_DOMICILIO_TITULAR',
    'IMOVEL_EXT_DOMICILIO_SUCESSOR',
    'MOVEL_EXT_DOMICILIO_SUCESSOR',
    'MOVEL_EXT_DOMICILIO_DONATARIO',
    'MOVEL_EXT_BEM_NO_BRASIL',
]);
const isForeignConnectionRule = (rule) => FOREIGN_CONNECTION_RULES.has(rule);
exports.isForeignConnectionRule = isForeignConnectionRule;
/** Bem no exterior por `location` (imóveis) ou `otherDetails.locationType`. */
const isAssetAbroad = (asset) => asset.location === 'EXTERIOR' || asset.otherDetails?.locationType === 'EXTERIOR';
exports.isAssetAbroad = isAssetAbroad;
const determinada = (state, competence) => ({ state, competence, indeterminada: false, porSucessor: false });
// CALC-03: os motores trocavam o dado faltante pela UF do processo (`x || selectedState`) e
// rotulavam a regra como se ela tivesse sido aplicada — o imposto ia para o Estado errado com
// a justificativa de outro. Agora a falta vira competência INDETERMINADA, com rótulo e aviso
// próprios; a UF do processo continua sendo usada, mas declaradamente como estimativa.
const indeterminada = (settings, competence, warning) => ({
    state: settings.selectedState,
    competence,
    indeterminada: true,
    porSucessor: false,
    warning,
});
const resolveAssetItcdCompetence = (asset, deceased, settings) => {
    const ufProcesso = settings.selectedState;
    const assetAbroad = (0, exports.isAssetAbroad)(asset);
    // De cujus no exterior: competência do domicílio de CADA sucessor (arts. 158, III / 159, II). A
    // apuração por sucessor (e a indeterminação de quem não tem UF informada) é feita no motor.
    const doSucessor = (regra) => ({
        state: deceased.successorDomicileState || settings.selectedState,
        competence: regra,
        indeterminada: false,
        porSucessor: true,
    });
    // --- Imóveis (art. 158) ---
    if (asset.type === 'IMOVEL') {
        if (!assetAbroad) {
            return asset.state
                ? determinada(asset.state, exports.ITCD_COMPETENCE_RULES.IMOVEL_SITUS)
                : indeterminada(settings, exports.ITCD_COMPETENCE_RULES.IMOVEL_UF_NAO_INFORMADA, (0, warnings_1.avisoCompetenciaIndeterminada)('a UF de situação do imóvel', ufProcesso, 'CF, art. 155, § 1º, I; LC 227/2026, art. 158, I'));
        }
        if (!deceased.domiciledAbroad) {
            return deceased.lastResidenceState
                ? determinada(deceased.lastResidenceState, exports.ITCD_COMPETENCE_RULES.IMOVEL_EXT_DOMICILIO_TITULAR)
                : indeterminada(settings, exports.ITCD_COMPETENCE_RULES.IMOVEL_EXT_DOMICILIO_NAO_INFORMADO, (0, warnings_1.avisoCompetenciaIndeterminada)('o domicílio do falecido (aba Autor da Herança)', ufProcesso, 'LC 227/2026, art. 158, II'));
        }
        return doSucessor(exports.ITCD_COMPETENCE_RULES.IMOVEL_EXT_DOMICILIO_SUCESSOR);
    }
    // --- Bens móveis, títulos e créditos (art. 159) ---
    if ((0, successionCore_1.isPreCompetenceChangeDeath)(deceased.deathDate ?? undefined)) {
        // Regra histórica: o processo é um só, e o ITCD dos móveis segue a UF dele. Aqui a UF do
        // processo É a regra — não há estimativa.
        return determinada(ufProcesso, exports.ITCD_COMPETENCE_RULES.MOVEL_INVENTARIO_PROCESSO);
    }
    if (deceased.domiciledAbroad) {
        return doSucessor(exports.ITCD_COMPETENCE_RULES.MOVEL_EXT_DOMICILIO_SUCESSOR);
    }
    return deceased.lastResidenceState
        ? determinada(deceased.lastResidenceState, exports.ITCD_COMPETENCE_RULES.MOVEL_DOMICILIO_DE_CUJUS)
        : indeterminada(settings, exports.ITCD_COMPETENCE_RULES.MOVEL_DOMICILIO_NAO_INFORMADO, (0, warnings_1.avisoCompetenciaIndeterminada)('o domicílio do falecido (aba Autor da Herança)', ufProcesso, 'CF, art. 155, § 1º, II, red. EC 132/2023; LC 227/2026, art. 159, I'));
};
exports.resolveAssetItcdCompetence = resolveAssetItcdCompetence;
const resolveAssetItcdState = (asset, deceased, settings) => (0, exports.resolveAssetItcdCompetence)(asset, deceased, settings).state;
exports.resolveAssetItcdState = resolveAssetItcdState;
