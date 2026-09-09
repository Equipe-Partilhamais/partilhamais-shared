"use strict";
// Núcleo da sucessão legítima: vocação hereditária, representação, legítima e os fatores de
// meação por regime. Era código DUPLICADO à mão em `partilhamais-frontend/services/
// calculationService.ts` e `partilhamais-backend/src/lib/calculationService.ts` — os dois já
// divergiram em produção. Aqui é a fonte única; os dois motores importam daqui e não têm mais
// cópia própria destas regras.
//
// O módulo é PURO: só recebe herdeiros e números, não conhece bens, passivos, ITCD nem
// emolumentos. Os tipos usam união de strings (e não os enums de cada app) porque os enums dos
// dois repositórios são `string enum` com os mesmos valores e são atribuíveis a estas uniões.
Object.defineProperty(exports, "__esModule", { value: true });
exports.allocateDebtByState = exports.getPrivateEstateFactor = exports.getCommonEstateFactor = exports.isPreCompetenceChangeDeath = exports.ITCD_COMPETENCE_CHANGE_DATE = exports.inofficiousReductionFactors = exports.buildCollateralShares = exports.siblingQuota = exports.collateralDegree = exports.buildDescendantSharesWithRepresentation = exports.resolveRepresentatives = exports.MAX_REPRESENTATION_DEPTH = exports.splitAmongAscendants = exports.callAscendants = exports.ascendantDegree = exports.spouseShareWithAscendants = exports.shouldSpouseCompeteWithDescendants = exports.inheritsInOwnRight = exports.isExcludedFromSuccession = exports.isRenouncer = void 0;
const isRenouncer = (h) => h.successionExclusion === 'RENUNCIA';
exports.isRenouncer = isRenouncer;
const isExcludedFromSuccession = (h) => !!h.successionExclusion;
exports.isExcludedFromSuccession = isExcludedFromSuccession;
// Herda por si quem está vivo e não foi excluído da sucessão.
const inheritsInOwnRight = (h) => !h.isPreDeceased && !(0, exports.isExcludedFromSuccession)(h);
exports.inheritsInOwnRight = inheritsInOwnRight;
const shouldSpouseCompeteWithDescendants = (regime, hasPrivateAssets) => {
    switch (regime) {
        case 'COMUNHAO_UNIVERSAL':
        case 'SEPARACAO_OBRIGATORIA':
            return false;
        case 'COMUNHAO_PARCIAL':
        case 'UNIAO_ESTAVEL':
            // Art. 1.829, I: o cônjuge só concorre com os descendentes se houver bens particulares.
            return hasPrivateAssets;
        case 'SEPARACAO_TOTAL':
            return true;
        default:
            return false;
    }
};
exports.shouldSpouseCompeteWithDescendants = shouldSpouseCompeteWithDescendants;
// Art. 1.837: 1/3 ao cônjuge apenas em concorrência com AMBOS os ascendentes de
// primeiro grau; metade se houver um só ascendente ou se o grau chamado for maior
// (avós, bisavós), qualquer que seja o número deles.
const spouseShareWithAscendants = (degree, ascCount) => {
    if (degree === 1 && ascCount > 1)
        return 1 / 3;
    return 1 / 2;
};
exports.spouseShareWithAscendants = spouseShareWithAscendants;
// Grau do ascendente derivado do subtipo: 'AVO' = 2º grau; qualquer outro
// (inclusive sem subtipo) é pai/mãe, 1º grau.
const ascendantDegree = (h) => (h.subtype === 'AVO' ? 2 : 1);
exports.ascendantDegree = ascendantDegree;
// Art. 1.836, §1º: na classe dos ascendentes o grau mais próximo exclui o mais
// remoto — com mãe viva os avós nada recebem.
const callAscendants = (ascendants) => {
    if (ascendants.length === 0)
        return { degree: 0, called: [] };
    const degree = ascendants.reduce((min, a) => Math.min(min, (0, exports.ascendantDegree)(a)), Number.POSITIVE_INFINITY);
    return { degree, called: ascendants.filter(a => (0, exports.ascendantDegree)(a) === degree) };
};
exports.callAscendants = callAscendants;
// Art. 1.836, §2º: havendo igualdade em grau e diversidade em linha, metade cabe a
// cada linha. A linha só é conhecida quando informada no herdeiro; sem ela mantém-se
// o rateio por cabeça, que dá o mesmo resultado quando as linhas estão equilibradas.
const splitAmongAscendants = (called, amount) => {
    const shares = new Map();
    const paternal = called.filter(a => a.ascendantLine === 'PATERNA');
    const maternal = called.filter(a => a.ascendantLine === 'MATERNA');
    if (paternal.length > 0 && maternal.length > 0 && paternal.length + maternal.length === called.length) {
        paternal.forEach(a => shares.set(a.id, amount / 2 / paternal.length));
        maternal.forEach(a => shares.set(a.id, amount / 2 / maternal.length));
        return shares;
    }
    called.forEach(a => shares.set(a.id, amount / called.length));
    return shares;
};
exports.splitAmongAscendants = splitAmongAscendants;
// Teto de profundidade da linha reta. O `parentId` é religado automaticamente pelos apps
// quando fica órfão e pode, em tese, formar ciclo: o teto e o conjunto de visitados impedem
// a recursão de rodar sem fim.
exports.MAX_REPRESENTATION_DEPTH = 12;
/**
 * Arts. 1.851/1.852: na linha reta descendente a representação desce sempre, sem
 * limite de grau. Art. 1.855: o quinhão do representado divide-se entre os
 * representantes DELE (por estirpe), não por cabeça no monte.
 */
const resolveRepresentatives = (heirs, represented, visited, depth) => {
    if (depth > exports.MAX_REPRESENTATION_DEPTH)
        return [];
    const branches = [];
    for (const child of heirs.filter(h => h.parentId === represented.id && !visited.has(h.id))) {
        visited.add(child.id);
        // Ninguém sucede representando renunciante (art. 1.811).
        if ((0, exports.isRenouncer)(child))
            continue;
        if ((0, exports.inheritsInOwnRight)(child)) {
            branches.push([{ heir: child, weight: 1 }]);
            continue;
        }
        const sub = (0, exports.resolveRepresentatives)(heirs, child, visited, depth + 1);
        if (sub.length > 0)
            branches.push(sub);
    }
    if (branches.length === 0)
        return [];
    const branchWeight = 1 / branches.length;
    return branches.flatMap(branch => branch.map(m => ({ heir: m.heir, weight: m.weight * branchWeight })));
};
exports.resolveRepresentatives = resolveRepresentatives;
/** Estirpes dos descendentes, já com a representação resolvida. */
const buildDescendantSharesWithRepresentation = (heirs) => {
    const children = heirs.filter(h => h.type === 'DESCENDENTE' && !h.parentId);
    const stirpes = [];
    for (const c of children) {
        if ((0, exports.isRenouncer)(c))
            continue;
        if ((0, exports.inheritsInOwnRight)(c)) {
            stirpes.push({ childId: c.id, members: [{ heir: c, weight: 1 }] });
            continue;
        }
        // Pré-morto, indigno ou deserdado: os descendentes representam (arts. 1.851 e 1.816).
        const members = (0, exports.resolveRepresentatives)(heirs, c, new Set([c.id]), 1);
        if (members.length > 0)
            stirpes.push({ childId: c.id, members });
    }
    if (stirpes.length > 0)
        return { stirpes };
    // Art. 1.811, parte final: renunciando todos os da classe, os filhos dos
    // renunciantes vêm à sucessão por direito próprio e POR CABEÇA — cada um é uma
    // estirpe, porque aqui não há representação.
    const renouncers = children.filter(exports.isRenouncer);
    heirs
        .filter(h => (0, exports.inheritsInOwnRight)(h) && renouncers.some(r => r.id === h.parentId))
        .forEach(h => stirpes.push({ childId: h.id, members: [{ heir: h, weight: 1 }] }));
    return { stirpes };
};
exports.buildDescendantSharesWithRepresentation = buildDescendantSharesWithRepresentation;
// Grau do colateral pelo subtipo: 'SOBRINHO' = 3º grau; os demais subtipos
// colaterais cadastráveis hoje são irmãos, 2º grau.
const collateralDegree = (h) => (h.subtype === 'SOBRINHO' ? 3 : 2);
exports.collateralDegree = collateralDegree;
// Arts. 1.841 e 1.843, §2º: o bilateral herda o dobro do unilateral. Sem o vínculo
// informado presume-se bilateral, que é o caso comum e o comportamento atual.
const siblingQuota = (h) => (h?.siblingBond === 'UNILATERAL' ? 1 : 2);
exports.siblingQuota = siblingQuota;
// Arts. 1.840/1.843/1.853: na classe dos colaterais o mais próximo exclui o mais
// remoto, salvo a representação dos filhos de irmão — que, ao contrário da linha
// reta, não desce além desse grau.
const buildCollateralShares = (collaterals) => {
    const siblings = collaterals.filter(h => (0, exports.collateralDegree)(h) === 2 && !(0, exports.isRenouncer)(h));
    if (siblings.some(exports.inheritsInOwnRight)) {
        const shares = [];
        for (const sibling of siblings) {
            const quota = (0, exports.siblingQuota)(sibling);
            if ((0, exports.inheritsInOwnRight)(sibling)) {
                shares.push({ heir: sibling, weight: quota });
                continue;
            }
            // Sobrinho sem irmão pré-morto/excluído a representar fica de fora (art. 1.840).
            const nephews = collaterals.filter(n => n.parentId === sibling.id && (0, exports.inheritsInOwnRight)(n));
            nephews.forEach(n => shares.push({ heir: n, weight: quota / nephews.length }));
        }
        return shares;
    }
    // Art. 1.843, §§1º e 2º: na falta de irmãos, os filhos deles herdam por cabeça,
    // recebendo o filho de irmão unilateral metade do que recebe o de bilateral.
    return collaterals
        .filter(h => (0, exports.collateralDegree)(h) === 3 && (0, exports.inheritsInOwnRight)(h))
        .map(n => ({ heir: n, weight: (0, exports.siblingQuota)(collaterals.find(s => s.id === n.parentId)) }));
};
exports.buildCollateralShares = buildCollateralShares;
// Art. 1.967, §1º: reduzem-se primeiro as quotas hereditárias testamentárias e só
// depois, se ainda insuficiente, os legados. Devolve o fator a aplicar em cada tipo.
const inofficiousReductionFactors = (dispositions, disposableLimit) => {
    const total = dispositions.reduce((sum, d) => sum + d.value, 0);
    const excess = total - disposableLimit;
    if (excess <= 0)
        return { quota: 1, legacy: 1 };
    const quotasTotal = dispositions.filter(d => d.kind === 'QUOTA').reduce((sum, d) => sum + d.value, 0);
    if (excess <= quotasTotal) {
        return { quota: quotasTotal > 0 ? (quotasTotal - excess) / quotasTotal : 1, legacy: 1 };
    }
    const legaciesTotal = total - quotasTotal;
    const remainingLegacies = Math.max(0, legaciesTotal - (excess - quotasTotal));
    return { quota: 0, legacy: legaciesTotal > 0 ? remainingLegacies / legaciesTotal : 1 };
};
exports.inofficiousReductionFactors = inofficiousReductionFactors;
// Marco de vigência da nova redação do art. 155, § 1º, II, da CF (EC 132/2023,
// publicada em 20/12/2023). Óbitos a partir de 20/12/2023 seguem o domicílio do
// de cujus para bens móveis; óbitos até 19/12/2023 seguem a regra histórica
// (UF onde se processa o inventário).
exports.ITCD_COMPETENCE_CHANGE_DATE = '2023-12-20';
const isPreCompetenceChangeDeath = (deathDate) => {
    if (!deathDate)
        return false;
    return deathDate < exports.ITCD_COMPETENCE_CHANGE_DATE;
};
exports.isPreCompetenceChangeDeath = isPreCompetenceChangeDeath;
// `hasSpouse` é obrigatório: sem meeiro(a) não há meação, então 100% do acervo integra o
// espólio e a base do ITCD. Antes o fator vinha só do regime, e um inventário com regime de
// comunhão mas SEM cônjuge cadastrado tinha metade do monte (e metade do imposto) sumindo.
const getCommonEstateFactor = (regime, hasSpouse) => {
    if (!hasSpouse)
        return 1;
    if (regime === 'COMUNHAO_UNIVERSAL' ||
        regime === 'COMUNHAO_PARCIAL' ||
        regime === 'UNIAO_ESTAVEL' ||
        regime === 'SEPARACAO_OBRIGATORIA') {
        return 0.5;
    }
    return 1;
};
exports.getCommonEstateFactor = getCommonEstateFactor;
const getPrivateEstateFactor = (regime, hasSpouse) => {
    if (!hasSpouse)
        return 1;
    if (regime === 'COMUNHAO_UNIVERSAL') {
        return 0.5;
    }
    return 1;
};
exports.getPrivateEstateFactor = getPrivateEstateFactor;
/** Rateia o passivo do espólio entre as UFs proporcionalmente ao acervo de cada uma. */
const allocateDebtByState = (valuesByState, totalDebt) => {
    const adjusted = new Map();
    const total = Array.from(valuesByState.values()).reduce((sum, value) => sum + value, 0);
    if (total <= 0 || totalDebt <= 0) {
        valuesByState.forEach((value, state) => adjusted.set(state, value));
        return adjusted;
    }
    valuesByState.forEach((value, state) => {
        const proportionalDebt = totalDebt * (value / total);
        adjusted.set(state, Math.max(0, value - proportionalDebt));
    });
    return adjusted;
};
exports.allocateDebtByState = allocateDebtByState;
