// Núcleo da sucessão legítima: vocação hereditária, representação, legítima e os fatores de
// meação por regime. Era código DUPLICADO à mão em `partilhamais-frontend/services/
// calculationService.ts` e `partilhamais-backend/src/lib/calculationService.ts` — os dois já
// divergiram em produção. Aqui é a fonte única; os dois motores importam daqui e não têm mais
// cópia própria destas regras.
//
// O módulo é PURO: só recebe herdeiros e números, não conhece bens, passivos, ITCD nem
// emolumentos. Os tipos usam união de strings (e não os enums de cada app) porque os enums dos
// dois repositórios são `string enum` com os mesmos valores e são atribuíveis a estas uniões.

export type SuccessionHeirType =
    | 'CONJUGE'
    | 'DESCENDENTE'
    | 'ASCENDENTE'
    | 'COLATERAL'
    | 'TESTAMENTARIO'
    | 'OUTROS';

export type SuccessionHeirSubtype =
    | 'FILHO'
    | 'FILHO_UNILATERAL'
    | 'NETO'
    | 'PAI'
    | 'AVO'
    | 'IRMAO'
    | 'SOBRINHO'
    | 'TESTAMENTARIO'
    | 'OUTRO';

export type SuccessionMaritalRegime =
    | 'COMUNHAO_UNIVERSAL'
    | 'COMUNHAO_PARCIAL'
    | 'SEPARACAO_TOTAL'
    | 'SEPARACAO_OBRIGATORIA'
    | 'SOLTEIRO'
    | 'UNIAO_ESTAVEL';

// Exclusão da sucessão. A diferença jurídica está no efeito sobre a representação:
// o renunciante não é representado (art. 1.811), o indigno/deserdado é (art. 1.816).
export type SuccessionExclusion = 'RENUNCIA' | 'INDIGNIDADE' | 'DESERDACAO';

export type SuccessionHeir = {
    id: string;
    name: string;
    type: SuccessionHeirType;
    subtype?: SuccessionHeirSubtype;
    isPreDeceased?: boolean;
    parentId?: string;
    testamentaryMode?: 'PERCENTAGE_OF_ESTATE' | 'SPECIFIC_ASSETS';
    testamentaryPercentage?: number;
    successionExclusion?: SuccessionExclusion;
    // Linha do ascendente (art. 1.836, §2º). Não é dedutível do subtipo — não há
    // vínculo entre o avô e o pai por onde inferi-la.
    ascendantLine?: 'PATERNA' | 'MATERNA';
    // Vínculo do irmão com o falecido (arts. 1.841 e 1.843, §2º).
    siblingBond?: 'BILATERAL' | 'UNILATERAL';
};

export type StirpeMember = { heir: SuccessionHeir; weight: number };

export const isRenouncer = (h: SuccessionHeir): boolean => h.successionExclusion === 'RENUNCIA';

export const isExcludedFromSuccession = (h: SuccessionHeir): boolean => !!h.successionExclusion;

// Herda por si quem está vivo e não foi excluído da sucessão.
export const inheritsInOwnRight = (h: SuccessionHeir): boolean =>
    !h.isPreDeceased && !isExcludedFromSuccession(h);

export const shouldSpouseCompeteWithDescendants = (
    regime: SuccessionMaritalRegime,
    hasPrivateAssets: boolean
): boolean => {
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

// Art. 1.837: 1/3 ao cônjuge apenas em concorrência com AMBOS os ascendentes de
// primeiro grau; metade se houver um só ascendente ou se o grau chamado for maior
// (avós, bisavós), qualquer que seja o número deles.
export const spouseShareWithAscendants = (degree: number, ascCount: number): number => {
    if (degree === 1 && ascCount > 1) return 1 / 3;
    return 1 / 2;
};

// Grau do ascendente derivado do subtipo: 'AVO' = 2º grau; qualquer outro
// (inclusive sem subtipo) é pai/mãe, 1º grau.
export const ascendantDegree = (h: SuccessionHeir): number => (h.subtype === 'AVO' ? 2 : 1);

// Art. 1.836, §1º: na classe dos ascendentes o grau mais próximo exclui o mais
// remoto — com mãe viva os avós nada recebem.
export const callAscendants = (
    ascendants: SuccessionHeir[]
): { degree: number; called: SuccessionHeir[] } => {
    if (ascendants.length === 0) return { degree: 0, called: [] };
    const degree = ascendants.reduce((min, a) => Math.min(min, ascendantDegree(a)), Number.POSITIVE_INFINITY);
    return { degree, called: ascendants.filter(a => ascendantDegree(a) === degree) };
};

// Art. 1.836, §2º: havendo igualdade em grau e diversidade em linha, metade cabe a
// cada linha. A linha só é conhecida quando informada no herdeiro; sem ela mantém-se
// o rateio por cabeça, que dá o mesmo resultado quando as linhas estão equilibradas.
export const splitAmongAscendants = (called: SuccessionHeir[], amount: number): Map<string, number> => {
    const shares = new Map<string, number>();
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

// Teto de profundidade da linha reta. O `parentId` é religado automaticamente pelos apps
// quando fica órfão e pode, em tese, formar ciclo: o teto e o conjunto de visitados impedem
// a recursão de rodar sem fim.
export const MAX_REPRESENTATION_DEPTH = 12;

/**
 * Arts. 1.851/1.852: na linha reta descendente a representação desce sempre, sem
 * limite de grau. Art. 1.855: o quinhão do representado divide-se entre os
 * representantes DELE (por estirpe), não por cabeça no monte.
 */
export const resolveRepresentatives = (
    heirs: SuccessionHeir[],
    represented: SuccessionHeir,
    visited: Set<string>,
    depth: number
): StirpeMember[] => {
    if (depth > MAX_REPRESENTATION_DEPTH) return [];
    const branches: StirpeMember[][] = [];

    for (const child of heirs.filter(h => h.parentId === represented.id && !visited.has(h.id))) {
        visited.add(child.id);
        // Ninguém sucede representando renunciante (art. 1.811).
        if (isRenouncer(child)) continue;
        if (inheritsInOwnRight(child)) {
            branches.push([{ heir: child, weight: 1 }]);
            continue;
        }
        const sub = resolveRepresentatives(heirs, child, visited, depth + 1);
        if (sub.length > 0) branches.push(sub);
    }

    if (branches.length === 0) return [];
    const branchWeight = 1 / branches.length;
    return branches.flatMap(branch => branch.map(m => ({ heir: m.heir, weight: m.weight * branchWeight })));
};

/** Estirpes dos descendentes, já com a representação resolvida. */
export const buildDescendantSharesWithRepresentation = (
    heirs: SuccessionHeir[]
): { stirpes: { childId: string; members: StirpeMember[] }[] } => {
    const children = heirs.filter(h => h.type === 'DESCENDENTE' && !h.parentId);
    const stirpes: { childId: string; members: StirpeMember[] }[] = [];

    for (const c of children) {
        if (isRenouncer(c)) continue;
        if (inheritsInOwnRight(c)) {
            stirpes.push({ childId: c.id, members: [{ heir: c, weight: 1 }] });
            continue;
        }
        // Pré-morto, indigno ou deserdado: os descendentes representam (arts. 1.851 e 1.816).
        const members = resolveRepresentatives(heirs, c, new Set<string>([c.id]), 1);
        if (members.length > 0) stirpes.push({ childId: c.id, members });
    }

    if (stirpes.length > 0) return { stirpes };

    // Art. 1.811, parte final: renunciando todos os da classe, os filhos dos
    // renunciantes vêm à sucessão por direito próprio e POR CABEÇA — cada um é uma
    // estirpe, porque aqui não há representação.
    const renouncers = children.filter(isRenouncer);
    heirs
        .filter(h => inheritsInOwnRight(h) && renouncers.some(r => r.id === h.parentId))
        .forEach(h => stirpes.push({ childId: h.id, members: [{ heir: h, weight: 1 }] }));

    return { stirpes };
};

// Grau do colateral pelo subtipo: 'SOBRINHO' = 3º grau; os demais subtipos
// colaterais cadastráveis hoje são irmãos, 2º grau.
export const collateralDegree = (h: SuccessionHeir): number => (h.subtype === 'SOBRINHO' ? 3 : 2);

// Arts. 1.841 e 1.843, §2º: o bilateral herda o dobro do unilateral. Sem o vínculo
// informado presume-se bilateral, que é o caso comum e o comportamento atual.
export const siblingQuota = (h?: SuccessionHeir): number => (h?.siblingBond === 'UNILATERAL' ? 1 : 2);

// Arts. 1.840/1.843/1.853: na classe dos colaterais o mais próximo exclui o mais
// remoto, salvo a representação dos filhos de irmão — que, ao contrário da linha
// reta, não desce além desse grau.
export const buildCollateralShares = (collaterals: SuccessionHeir[]): StirpeMember[] => {
    const siblings = collaterals.filter(h => collateralDegree(h) === 2 && !isRenouncer(h));

    if (siblings.some(inheritsInOwnRight)) {
        const shares: StirpeMember[] = [];
        for (const sibling of siblings) {
            const quota = siblingQuota(sibling);
            if (inheritsInOwnRight(sibling)) {
                shares.push({ heir: sibling, weight: quota });
                continue;
            }
            // Sobrinho sem irmão pré-morto/excluído a representar fica de fora (art. 1.840).
            const nephews = collaterals.filter(n => n.parentId === sibling.id && inheritsInOwnRight(n));
            nephews.forEach(n => shares.push({ heir: n, weight: quota / nephews.length }));
        }
        return shares;
    }

    // Art. 1.843, §§1º e 2º: na falta de irmãos, os filhos deles herdam por cabeça,
    // recebendo o filho de irmão unilateral metade do que recebe o de bilateral.
    return collaterals
        .filter(h => collateralDegree(h) === 3 && inheritsInOwnRight(h))
        .map(n => ({ heir: n, weight: siblingQuota(collaterals.find(s => s.id === n.parentId)) }));
};

// Art. 1.967, §1º: reduzem-se primeiro as quotas hereditárias testamentárias e só
// depois, se ainda insuficiente, os legados. Devolve o fator a aplicar em cada tipo.
export const inofficiousReductionFactors = (
    dispositions: { kind: 'QUOTA' | 'LEGADO'; value: number }[],
    disposableLimit: number
): { quota: number; legacy: number } => {
    const total = dispositions.reduce((sum, d) => sum + d.value, 0);
    const excess = total - disposableLimit;
    if (excess <= 0) return { quota: 1, legacy: 1 };

    const quotasTotal = dispositions.filter(d => d.kind === 'QUOTA').reduce((sum, d) => sum + d.value, 0);
    if (excess <= quotasTotal) {
        return { quota: quotasTotal > 0 ? (quotasTotal - excess) / quotasTotal : 1, legacy: 1 };
    }

    const legaciesTotal = total - quotasTotal;
    const remainingLegacies = Math.max(0, legaciesTotal - (excess - quotasTotal));
    return { quota: 0, legacy: legaciesTotal > 0 ? remainingLegacies / legaciesTotal : 1 };
};

// Marco de vigência da nova redação do art. 155, § 1º, II, da CF (EC 132/2023,
// publicada em 20/12/2023). Óbitos a partir de 20/12/2023 seguem o domicílio do
// de cujus para bens móveis; óbitos até 19/12/2023 seguem a regra histórica
// (UF onde se processa o inventário).
export const ITCD_COMPETENCE_CHANGE_DATE = '2023-12-20';

export const isPreCompetenceChangeDeath = (deathDate?: string): boolean => {
    if (!deathDate) return false;
    return deathDate < ITCD_COMPETENCE_CHANGE_DATE;
};

// `hasSpouse` é obrigatório: sem meeiro(a) não há meação, então 100% do acervo integra o
// espólio e a base do ITCD. Antes o fator vinha só do regime, e um inventário com regime de
// comunhão mas SEM cônjuge cadastrado tinha metade do monte (e metade do imposto) sumindo.
export const getCommonEstateFactor = (regime: SuccessionMaritalRegime, hasSpouse: boolean): number => {
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

export const getPrivateEstateFactor = (regime: SuccessionMaritalRegime, hasSpouse: boolean): number => {
    if (!hasSpouse) return 1;
    if (regime === 'COMUNHAO_UNIVERSAL') {
        return 0.5;
    }

    return 1;
};

/** Rateia o passivo do espólio entre as UFs proporcionalmente ao acervo de cada uma. */
export const allocateDebtByState = <K>(valuesByState: Map<K, number>, totalDebt: number): Map<K, number> => {
    const adjusted = new Map<K, number>();
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
