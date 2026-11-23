/**
 * Calculation Service - Core business logic for partition calculations
 * Migrated from frontend to backend for proper separation of concerns
 */

import {
    MaritalRegime,
    AssetType,
    AssetOrigin,
    HeirType,
    AllocationTarget,
    CalculationResult,
    InventoryStateForCalculation,
    UF,
    AssetValuationBasis,
    LiabilityDistributionCriterion,
    LiabilityPartitionTreatment,
    DonationEvent,
} from './enums';
import { calculateItcdForState } from './backend.itcd';
import { getNotaryFees } from './backend.notaryFees';
import {
    allocateDebtByState,
    buildCollateralShares,
    buildDescendantSharesWithRepresentation,
    callAscendants,
    collateralDegree,
    getCommonEstateFactor,
    getPrivateEstateFactor,
    inheritsInOwnRight,
    inofficiousReductionFactors,
    isExcludedFromSuccession,
    isPreCompetenceChangeDeath,
    isRenouncer,
    shouldSpouseCompeteWithDescendants,
    splitAmongAscendants,
    spouseShareWithAscendants,
    SuccessionExclusion,
    SuccessionHeir,
} from './nucleoCongelado';

// Núcleo da sucessão (vocação hereditária, representação, legítima, fatores de meação e
// rateio do passivo por UF) vive em @partilhamais/shared: era mantido em DUAS cópias à mão,
// aqui e no motor do frontend, e as duas já divergiram. Nada dessas regras volta para cá.
export type { SuccessionExclusion };
type HeirLike = SuccessionHeir;

// Art. 1.840: o sobrinho so e chamado por representacao quando o motor consegue liga-lo ao
// irmao que ele representa, e esse vinculo nao chega preenchido — o cadastro so pergunta o
// pai quando o parentesco e NETO. Sem `parentId` o nucleo descartava o sobrinho em silencio
// e o quinhao do irmao pre-morto ia inteiro para o irmao vivo. Havendo UM unico irmao a ser
// representado o vinculo e inequivoco (o sobrinho so e herdeiro por representa-lo) e e
// reconstruido aqui; com mais de um candidato, escolher um mudaria o direito de
// representacao, entao o sobrinho continua sem vinculo. (paridade com o motor do frontend)
const linkNephewsToRepresentedSibling = (collaterals: HeirLike[]): HeirLike[] => {
    const orphanNephews = collaterals.filter(h => collateralDegree(h) === 3 && !h.parentId);
    if (orphanNephews.length === 0) return collaterals;

    // O renunciante nao e representado (art. 1.811) e o irmao vivo herda por si: nenhum dos
    // dois e candidato a representado.
    const represented = collaterals.filter(
        h => collateralDegree(h) === 2 && !inheritsInOwnRight(h) && !isRenouncer(h)
    );
    if (represented.length !== 1) return collaterals;

    return collaterals.map(h =>
        orphanNephews.includes(h) ? { ...h, parentId: represented[0].id } : h
    );
};

const isAssetAbroad = (asset: { location?: string; otherDetails?: { locationType?: string } | null }): boolean =>
    asset.location === 'EXTERIOR' || (asset.otherDetails as { locationType?: string } | null)?.locationType === 'EXTERIOR';

// Espelha a matriz de sujeição ativa dos arts. 158/159 da LC 227/2026 (ver frontend
// resolveAssetItcdCompetence). Mantém paridade com o cálculo exibido ao usuário.
const resolveAssetItcdState = (
    asset: { type: AssetType; state?: UF; location?: string; otherDetails?: { locationType?: string } | null },
    deceased: { deathDate?: string; lastResidenceState?: UF; domiciledAbroad?: boolean; successorDomicileState?: UF },
    settings: { selectedState: UF; itcdMovableState?: UF }
): UF => {
    const successorState = deceased.successorDomicileState || settings.selectedState;

    // Imóveis (art. 158)
    if (asset.type === AssetType.IMOVEL) {
        if (!isAssetAbroad(asset)) {
            return asset.state || settings.selectedState;
        }
        // Imóvel no exterior
        if (!deceased.domiciledAbroad) {
            return deceased.lastResidenceState || settings.selectedState;
        }
        return successorState;
    }

    // Bens móveis, títulos e créditos (art. 159)
    if (isPreCompetenceChangeDeath(deceased.deathDate)) {
        // Processo é um só: ITCD dos bens móveis (regra histórica) segue o Estado do
        // processo/escritura (selectedState) — sem seletor separado.
        return settings.selectedState;
    }
    if (deceased.domiciledAbroad) {
        return successorState;
    }
    return deceased.lastResidenceState || settings.selectedState;
};

type LiabilityLike = InventoryStateForCalculation['liabilities'][number];
type AssetLike = InventoryStateForCalculation['assets'][number];

const normalizeLiability = (liability: LiabilityLike): LiabilityLike & {
    partitionTreatment: LiabilityPartitionTreatment;
    distributionCriterion: LiabilityDistributionCriterion;
    assetLinks: Array<{ assetId: string; deductedValue: number }>;
} => {
    const partitionTreatment =
        liability.partitionTreatment ||
        (liability.responsibleHeirId ? LiabilityPartitionTreatment.HERDEIRO_TORNA : undefined) ||
        (liability.paymentMode === 'HEIRS' ? LiabilityPartitionTreatment.HERDEIRO_TORNA : undefined) ||
        (liability.paymentMode === 'ESTATE' ? LiabilityPartitionTreatment.ESPOLIO : undefined) ||
        ((liability.assetLinks?.length || 0) > 0 ? LiabilityPartitionTreatment.BEM_VINCULADO : undefined) ||
        LiabilityPartitionTreatment.ESPOLIO;

    return {
        ...liability,
        partitionTreatment,
        distributionCriterion: liability.distributionCriterion || LiabilityDistributionCriterion.PROPORCIONAL,
        assetLinks: (liability.assetLinks || [])
            .filter(link => !!link.assetId && Number.isFinite(link.deductedValue) && link.deductedValue > 0)
            .map(link => ({
                assetId: link.assetId,
                deductedValue: Number(link.deductedValue),
            })),
    };
};

export const calculatePartition = (data: InventoryStateForCalculation): CalculationResult => {
    const emptyResult: CalculationResult = {
        totalAssets: 0,
        totalLiabilities: 0,
        netEstate: 0,
        totalMeacao: 0,
        herancaTotal: 0,
        successionBase: 0,
        disposablePortion: 0,
        compulsoryPortion: 0,
        testamentaryTotal: 0,
        isTestamentaryExcessive: false,
        taxBase: 0,
        taxAmount: 0,
        totalExcessTax: 0,
        pendingEstateLiabilitiesTotal: 0,
        projectedNetEstate: 0,
        discountsApplied: [],
        targets: [],
        notaryFee: 0,
        deedFee: 0,
        registryFee: 0,
        itcdBreakdown: [],
        donationBreakdown: [],
        estateSettlementItems: [],
        assetDebtSummary: [],
        liabilityReport: [],
    };

    if (!data) {
        return emptyResult;
    }

    const { assets, liabilities, deceased, heirs, settings } = data;
    if (!assets || !heirs || !deceased) {
        return emptyResult;
    }

    const safeSettings = settings || { applyInventoryDiscount: false, selectedState: 'MG' as UF, itcdMovableState: 'MG' as UF, donationState: 'MG' as UF, assetValuationBasis: 'MARKET' as AssetValuationBasis };
    const valuationBasis: AssetValuationBasis = safeSettings.assetValuationBasis === 'STATE' ? 'STATE' : 'MARKET';
    const currentAssets = assets.filter(a => a.type !== AssetType.ADIANTAMENTO);
    const advancements = assets.filter(a => a.type === AssetType.ADIANTAMENTO);

    /* 
     * Função auxiliar para calcular o valor real do bem considerando o percentual de propriedade
     */
    const getAssetValue = (asset: any) => {
        const stateAssessedValue = asset?.otherDetails?.stateAssessedValue;
        const hasStateAssessedValue = typeof stateAssessedValue === 'number' && Number.isFinite(stateAssessedValue) && stateAssessedValue > 0;
        const rawValue = valuationBasis === 'STATE' && hasStateAssessedValue ? stateAssessedValue : (asset.marketValue || 0);
        const percentage = (asset.ownershipPercentage !== undefined && asset.ownershipPercentage !== null) 
            ? asset.ownershipPercentage 
            : 100;
        return rawValue * (percentage / 100);
    };

    const normalizedLiabilities = (liabilities ?? []).map(normalizeLiability);
    const linkedAssetLiabilities = normalizedLiabilities.filter(
        liability => liability.partitionTreatment === LiabilityPartitionTreatment.BEM_VINCULADO
    );
    const estateSettlementLiabilities = normalizedLiabilities.filter(
        liability => liability.partitionTreatment === LiabilityPartitionTreatment.ESPOLIO
    );
    const assumedHeirLiabilities = normalizedLiabilities.filter(
        liability => liability.partitionTreatment === LiabilityPartitionTreatment.HERDEIRO_TORNA
    );
    const assumedHeirDebts = normalizedLiabilities
        .filter(
            liability =>
                liability.partitionTreatment === LiabilityPartitionTreatment.HERDEIRO_TORNA &&
                !!liability.responsibleHeirId &&
                (liability.value || 0) > 0
        )
        .map(liability => ({
            liabilityId: liability.id,
            personId: liability.responsibleHeirId!,
            description: liability.description || 'Dívida',
            value: liability.value,
            escrituraObservation: liability.escrituraObservation,
        }));

    const assetDebtSummary = currentAssets.map(asset => {
        const grossValue = getAssetValue(asset);
        const linkedLiabilities = linkedAssetLiabilities.flatMap(liability =>
            (liability.assetLinks || [])
                .filter(link => link.assetId === asset.id)
                .map(link => ({
                    liabilityId: liability.id,
                    description: liability.description || 'Dívida',
                    deductedValue: link.deductedValue,
                    criterion: liability.distributionCriterion,
                }))
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
    const assetDebtSummaryMap = new Map(assetDebtSummary.map(item => [item.assetId, item]));

    const getAssetNetValue = (asset: AssetLike) => {
        return assetDebtSummaryMap.get(asset.id)?.netValue ?? getAssetValue(asset);
    };

    const getAssignedAssetValue = (asset: AssetLike, assignment: { percentage?: number; value?: number }) => {
        const pct = assignment?.percentage;
        if (typeof pct === 'number' && Number.isFinite(pct)) {
            return (getAssetNetValue(asset) * pct) / 100;
        }
        return assignment?.value || 0;
    };

    const commonAssetsByState = new Map<UF, number>();
    const privateAssetsByState = new Map<UF, number>();
    const assetCountByState = new Map<UF, number>();

    currentAssets.forEach(asset => {
        const state = resolveAssetItcdState(asset, deceased, safeSettings);
        const value = getAssetNetValue(asset);
        const targetMap = asset.origin === AssetOrigin.COMUM ? commonAssetsByState : privateAssetsByState;

        targetMap.set(state, (targetMap.get(state) || 0) + value);
        assetCountByState.set(state, (assetCountByState.get(state) || 0) + 1);
    });

    const commonAssetsVal = currentAssets.filter(a => a.origin === AssetOrigin.COMUM).reduce((s, a) => s + getAssetNetValue(a), 0);
    const privateAssetsVal = currentAssets.filter(a => a.origin === AssetOrigin.PARTICULAR).reduce((s, a) => s + getAssetNetValue(a), 0);
    const totalColacao = advancements.reduce((s, a) => s + getAssetValue(a), 0);

    const safeLiabilities = normalizedLiabilities;
    const totalDebtCommon = assumedHeirLiabilities.filter(l => l.origin === AssetOrigin.COMUM).reduce((s, l) => s + (l.value || 0), 0);
    const totalDebtPrivate = assumedHeirLiabilities.filter(l => l.origin === AssetOrigin.PARTICULAR).reduce((s, l) => s + (l.value || 0), 0);
    const pendingEstateLiabilitiesTotal = estateSettlementLiabilities.reduce((sum, liability) => sum + (liability.value || 0), 0);
    const totalLiabilitiesValue = safeLiabilities.reduce((s, l) => s + (l.value || 0), 0);

    const netCommon = Math.max(0, commonAssetsVal - totalDebtCommon);
    const netPrivate = Math.max(0, privateAssetsVal - totalDebtPrivate);

    const herancaLiquidaFisicaTotal = netCommon + netPrivate;
    const projectedNetEstate = Math.max(0, herancaLiquidaFisicaTotal - pendingEstateLiabilitiesTotal);

    // Identifica o meeiro ANTES de calcular a meacao: ela so existe se houver
    // conjuge/companheiro(a). Sem isso, um inventario de viuvo(a) (ou com o regime
    // preenchido antes do nome do conjuge) tinha metade do acervo descontada sem
    // ser atribuida a ninguem, e a base do ITCD caia pela metade.
    const spousePerson = heirs.find(h => h.type === HeirType.CONJUGE);
    const hasSpouse = !!spousePerson || (!!deceased.spouseName && deceased.maritalRegime !== MaritalRegime.SOLTEIRO);

    let totalMeacao = 0;
    if (hasSpouse) {
        if (deceased.maritalRegime === MaritalRegime.COMUNHAO_UNIVERSAL) {
            totalMeacao = herancaLiquidaFisicaTotal * 0.5;
        } else if (deceased.maritalRegime === MaritalRegime.COMUNHAO_PARCIAL || deceased.maritalRegime === MaritalRegime.UNIAO_ESTAVEL || deceased.maritalRegime === MaritalRegime.SEPARACAO_OBRIGATORIA) {
            totalMeacao = netCommon * 0.5;
        }
    }

    const monteMorFisicoPartilhavel = herancaLiquidaFisicaTotal - totalMeacao;
    const successionBase = monteMorFisicoPartilhavel + totalColacao;
    const commonEstateFactor = getCommonEstateFactor(deceased.maritalRegime, hasSpouse);
    const privateEstateFactor = getPrivateEstateFactor(deceased.maritalRegime, hasSpouse);
    const netCommonByState = allocateDebtByState(commonAssetsByState, totalDebtCommon);
    const netPrivateByState = allocateDebtByState(privateAssetsByState, totalDebtPrivate);

    // CORREÇÃO CRÍTICA (Solicitação do cliente 07/01/2026):
    // Parte Disponível = Monte Mor Físico / 2 (SEM colação)
    // Isso define o limite real para testamentos/legados sobre bens existentes
    const disposablePortion = monteMorFisicoPartilhavel * 0.5;
    
    // Legítima = (Monte Mor Físico / 2) + Colação integral
    // A colação é somada DEPOIS da divisão, pois pertence exclusivamente à legítima dos herdeiros necessários
    const compulsoryPortion = (monteMorFisicoPartilhavel * 0.5) + totalColacao;

    const targets: AllocationTarget[] = [];
    const getTarget = (pId: string, pName: string, pType: HeirType): AllocationTarget => {
        let t = targets.find(item => item.personId === pId);
        if (!t) {
            t = {
                personId: pId, personName: pName, personType: pType,
                meacaoValue: 0, theoreticalValue: 0, advancementValue: 0, inheritanceValue: 0,
                legitimaValue: 0, testamentaryValue: 0,
                totalTargetValue: 0, percentageOfEstate: 0, grossTargetValue: 0, grossAllocatedValue: 0, assumedDebtValue: 0, allocatedValue: 0, excessValue: 0, underValue: 0, excessTax: 0,
            };
            targets.push(t);
        }
        return t;
    };
    const addLegitimateShare = (target: AllocationTarget, shareValue: number) => {
        target.theoreticalValue += shareValue;
        target.legitimaValue += shareValue;
    };

    // (spousePerson/hasSpouse ja resolvidos antes do bloco da meacao)
    const spouseId = spousePerson?.id ?? 'spouse_auto';
    const spouseName = spousePerson?.name ?? deceased.spouseName ?? 'Cônjuge';
    if (hasSpouse) getTarget(spouseId, spouseName, HeirType.CONJUGE).meacaoValue = totalMeacao;

    heirs.forEach(h => {
        if (h.id !== 'spouse_auto' && !(h as any).isSpouse) {
            getTarget(h.id, h.name, h.type);
        }
    });

    const allHeirs = heirs as unknown as HeirLike[];
    const descendants = allHeirs.filter(h => h.type === HeirType.DESCENDENTE);
    const ascendants = allHeirs.filter(h => h.type === HeirType.ASCENDENTE && !h.isPreDeceased && !isExcludedFromSuccession(h));
    const collaterals = allHeirs.filter(h => h.type === HeirType.COLATERAL);

    // As classes sao montadas ANTES do testamento porque a reducao das disposicoes
    // inoficiosas depende de existir herdeiro necessario chamado (art. 1.789).
    // `descendants` inclui pre-mortos, mas so vira estirpe quem esta vivo ou deixou
    // representantes. Com um filho pre-morto e SEM netos, o ramo era escolhido mesmo
    // assim e `pool / 0` gerava Infinity/NaN — o acervo sumia e os ascendentes nunca
    // eram avaliados. (paridade com o motor do frontend)
    const { stirpes } = buildDescendantSharesWithRepresentation(descendants);
    const { degree: calledAscendantDegree, called: calledAscendants } = callAscendants(ascendants);
    const collateralShares = buildCollateralShares(linkNephewsToRepresentedSibling(collaterals));

    // A renuncia nao atinge a meacao, que nao e heranca: o conjuge renunciante segue
    // meeiro, mas nao concorre na sucessao.
    const spouseInherits = hasSpouse && !(spousePerson && isExcludedFromSuccession(spousePerson as unknown as HeirLike));
    const hasCompulsoryHeirs = stirpes.length > 0 || calledAscendants.length > 0 || spouseInherits;

    let testamentaryTotal = 0;
    // Total disposto no testamento ANTES da reducao — e ele que alimenta o alerta de
    // inoficiosidade exibido ao usuario.
    let testamentaryDisposed = 0;
    if (deceased.hasWill) {
        // B7: alinha com o frontend — processa disposições testamentárias de TODOS
        // os herdeiros, não só os do tipo TESTAMENTARIO. Um herdeiro legítimo (ex.:
        // DESCENDENTE) também pode receber quota/legado da parte disponível via
        // testamento, e isso precisa refletir na partição e no ITCD.
        const testamentaries = heirs.filter(h =>
            h.type === HeirType.TESTAMENTARIO ||
            (!!h.testamentaryMode && (h.testamentaryPercentage || 0) > 0) ||
            h.testamentaryMode === 'SPECIFIC_ASSETS'
        );
        type TestamentaryDisposition = { heir: (typeof testamentaries)[number]; kind: 'QUOTA' | 'LEGADO'; value: number };
        const dispositions: TestamentaryDisposition[] = testamentaries.flatMap<TestamentaryDisposition>(h => {
            if (h.testamentaryMode === 'PERCENTAGE_OF_ESTATE') {
                return [{ heir: h, kind: 'QUOTA', value: successionBase * ((h.testamentaryPercentage || 0) / 100) }];
            }
            if (h.testamentaryMode === 'SPECIFIC_ASSETS') {
                const legacyValue = currentAssets.reduce((sum, asset) => {
                    // Paridade com o frontend: só a atribuição travada PELO TESTAMENTO é
                    // legado. Sem esse filtro, o bem que o mesmo herdeiro recebe por
                    // herança legítima era contado como legado, inflando o testamento e
                    // encolhendo o quinhão dos demais.
                    const asg = asset.assignments.find(
                        a => a.personId === h.id && (a as { lockReason?: string }).lockReason === 'TESTAMENT'
                    );
                    return sum + (asg ? getAssignedAssetValue(asset, asg) : 0);
                }, 0);
                return [{ heir: h, kind: 'LEGADO', value: legacyValue }];
            }
            return [];
        });

        testamentaryDisposed = dispositions.reduce((sum, d) => sum + d.value, 0);

        // Arts. 1.846/1.967: a legitima e intocavel — o que exceder a parte disponivel
        // e REDUZIDO antes do rateio, em vez de o testamentario ser servido primeiro
        // pelo valor integral e os necessarios ficarem com o que sobrasse (podendo ser
        // zero). Sem herdeiro necessario chamado nao ha legitima a proteger (art.
        // 1.789) e a disposicao vale integralmente.
        const disposableLimit = hasCompulsoryHeirs ? disposablePortion : testamentaryDisposed;
        const reduction = inofficiousReductionFactors(dispositions, disposableLimit);

        dispositions.forEach(d => {
            const value = d.value * (d.kind === 'QUOTA' ? reduction.quota : reduction.legacy);
            const target = getTarget(d.heir.id, d.heir.name, d.heir.type);
            target.theoreticalValue += value;
            target.testamentaryValue += value;
            testamentaryTotal += value;
        });
    }

    // CORREÇÃO CRÍTICA: O pool disponível para os herdeiros legítimos é a Base Total menos o que foi testado
    // Isso corrige o erro de duplicidade onde remainingDisposable era somado incorretamente
    // Piso em zero: legado/testamento maior que a base transmissivel tornava este
    // valor NEGATIVO e o negativo se propagava para os pools e percentuais, gerando
    // quinhao negativo e percentual fora de 0-100%. (paridade com o frontend)
    const availableForHeirs = Math.max(0, successionBase - testamentaryTotal);

    if (stirpes.length > 0) {
        const hasPrivateAssets = netPrivate > 0;
        const spouseCompetes = spouseInherits && shouldSpouseCompeteWithDescendants(deceased.maritalRegime, hasPrivateAssets);
        const isPartial = deceased.maritalRegime === MaritalRegime.COMUNHAO_PARCIAL || deceased.maritalRegime === MaritalRegime.UNIAO_ESTAVEL;

        // Proporções de bens comuns e particulares na herança disponível
        const ratioCommon = monteMorFisicoPartilhavel > 0 ? (netCommon * 0.5) / monteMorFisicoPartilhavel : 0;
        const ratioPrivate = 1 - ratioCommon;

        // Pools ajustados para retirar o impacto do testamento proporcionalmente
        const commonPool = availableForHeirs * ratioCommon;
        const privatePool = availableForHeirs * ratioPrivate;

        let spousePrivateShare = 0;
        let stirpePrivateShare = 0;

        if (spouseCompetes && isPartial) {
            // COMUNHÃO PARCIAL / UNIÃO ESTÁVEL: cônjuge concorre APENAS nos bens PARTICULARES
            const numStirpes = stirpes.length;
            const hasHybridDescendants = descendants.some(d => d.subtype === 'FILHO_UNILATERAL');
            if (!hasHybridDescendants && numStirpes >= 4) {
                spousePrivateShare = privatePool * 0.25;
                stirpePrivateShare = (privatePool - spousePrivateShare) / numStirpes;
            } else {
                spousePrivateShare = privatePool / (numStirpes + 1);
                stirpePrivateShare = spousePrivateShare;
            }
            const spouseTarget = getTarget(spouseId, spouseName, HeirType.CONJUGE);
            addLegitimateShare(spouseTarget, spousePrivateShare);
        } else if (spouseCompetes && !isPartial) {
            // SEPARAÇÃO TOTAL: cônjuge concorre em TODOS os bens (comum + particular)
            // Aplica reserva da 4ª parte quando há 4+ filhos (Art. 1832 CC)
            const numStirpes = stirpes.length;
            const totalPool = commonPool + privatePool;
            const hasHybridDescendants = descendants.some(d => d.subtype === 'FILHO_UNILATERAL');
            
            let spouseTotalShare = 0;
            let stirpeTotalShare = 0;
            
            if (!hasHybridDescendants && numStirpes >= 4) {
                spouseTotalShare = totalPool * 0.25;
                stirpeTotalShare = (totalPool - spouseTotalShare) / numStirpes;
            } else {
                spouseTotalShare = totalPool / (numStirpes + 1);
                stirpeTotalShare = spouseTotalShare;
            }
            
            const spouseTarget = getTarget(spouseId, spouseName, HeirType.CONJUGE);
            addLegitimateShare(spouseTarget, spouseTotalShare);
            
            // O peso ja traz a divisao por estirpe (art. 1.855), inclusive nos graus
            // mais remotos da representacao.
            stirpes.forEach(st => {
                st.members.forEach(member => {
                    const memberTarget = getTarget(member.heir.id, member.heir.name, HeirType.DESCENDENTE);
                    addLegitimateShare(memberTarget, stirpeTotalShare * member.weight);
                });
            });
        } else {
            stirpePrivateShare = privatePool / stirpes.length;
        }

        // Distribuição de bens comuns para descendentes (só executa se NÃO for Separação Total)
        const isSeparacaoTotal = deceased.maritalRegime === MaritalRegime.SEPARACAO_TOTAL;
        if (!isSeparacaoTotal || !spouseCompetes) {
            const stirpeCommonShare = commonPool / stirpes.length;

            stirpes.forEach(st => {
                const totalStirpeShare = stirpePrivateShare + stirpeCommonShare;
                st.members.forEach(member => {
                    const memberTarget = getTarget(member.heir.id, member.heir.name, HeirType.DESCENDENTE);
                    addLegitimateShare(memberTarget, totalStirpeShare * member.weight);
                });
            });
        }
    }
    else if (calledAscendants.length > 0) {
        // So os ascendentes do grau mais proximo sao chamados (art. 1.836, §1º); dentro
        // do grau, o rateio segue as linhas paterna e materna (§2º).
        let ascendantPool = availableForHeirs;
        if (spouseInherits) {
            const spouseRatio = spouseShareWithAscendants(calledAscendantDegree, calledAscendants.length);
            const spouseShare = availableForHeirs * spouseRatio;
            const spouseTarget = getTarget(spouseId, spouseName, HeirType.CONJUGE);
            addLegitimateShare(spouseTarget, spouseShare);
            ascendantPool = availableForHeirs - spouseShare;
        }
        const ascendantShares = splitAmongAscendants(calledAscendants, ascendantPool);
        calledAscendants.forEach(a => {
            const ascendantTarget = getTarget(a.id, a.name, HeirType.ASCENDENTE);
            addLegitimateShare(ascendantTarget, ascendantShares.get(a.id) || 0);
        });
    }
    else if (spouseInherits) {
        const spouseTarget = getTarget(spouseId, spouseName, HeirType.CONJUGE);
        addLegitimateShare(spouseTarget, availableForHeirs);
    }
    else if (collateralShares.length > 0) {
        // O peso ja embute o grau, a representacao dos filhos de irmao e o dobro do
        // vinculo bilateral (arts. 1.840, 1.841, 1.843 e 1.853).
        const totalCollateralWeight = collateralShares.reduce((sum, m) => sum + m.weight, 0);
        collateralShares.forEach(member => {
            const collateralTarget = getTarget(member.heir.id, member.heir.name, HeirType.COLATERAL);
            addLegitimateShare(collateralTarget, totalCollateralWeight > 0 ? availableForHeirs * (member.weight / totalCollateralWeight) : 0);
        });
    }

    targets.forEach(t => {
        t.advancementValue = advancements.filter(a => a.beneficiaryId === t.personId).reduce((s, a) => s + getAssetValue(a), 0);
    });

    // Arts. 2.002/2.003: quando o adiantamento supera o quinhao, o excesso nao pode
    // simplesmente desaparecer num `Math.max(0, ...)` — o donatario fica fora da
    // partilha dos bens remanescentes e o acervo fisico restante e redividido entre os
    // demais, igualando os quinhoes o quanto possivel (art. 2.017). Antes, cada
    // herdeiro recebia `quinhao - adiantamento` com piso zero e a partilha chegava a
    // distribuir mais do que o acervo existente.
    const physicalToShare = targets.reduce((sum, t) => sum + (t.theoreticalValue - t.advancementValue), 0);
    let sharingTargets = [...targets];
    for (let pass = 0; pass <= targets.length; pass++) {
        const totalTheoretical = sharingTargets.reduce((sum, t) => sum + t.theoreticalValue, 0);
        if (totalTheoretical <= 0) {
            sharingTargets.forEach(t => { t.inheritanceValue = 0; });
            break;
        }
        // Quem continua na partilha traz o proprio adiantamento a colacao; o de quem ja
        // saiu fica fora da massa, porque ele nada mais recebe.
        const collated = sharingTargets.reduce((sum, t) => sum + t.advancementValue, 0);
        const mass = Math.max(0, physicalToShare) + collated;
        const allotment = (t: AllocationTarget) => (mass * t.theoreticalValue) / totalTheoretical;
        const overEndowed = sharingTargets.filter(t => t.advancementValue > allotment(t) + 0.005);
        if (overEndowed.length === 0) {
            sharingTargets.forEach(t => { t.inheritanceValue = Math.max(0, allotment(t) - t.advancementValue); });
            break;
        }
        overEndowed.forEach(t => { t.inheritanceValue = 0; });
        sharingTargets = sharingTargets.filter(t => !overEndowed.includes(t));
    }

    targets.forEach(t => {
        t.totalTargetValue = t.meacaoValue + t.inheritanceValue;
        t.grossTargetValue = t.totalTargetValue;
        t.percentageOfEstate = successionBase > 0 ? (t.theoreticalValue / successionBase) * 100 : 0;
    });

    currentAssets.forEach(asset => asset.assignments.forEach(asg => {
        const t = targets.find(tar => tar.personId === asg.personId);
        if (t) t.grossAllocatedValue = (t.grossAllocatedValue || 0) + getAssignedAssetValue(asset, asg);
    }));

    assumedHeirDebts.forEach(debt => {
        const target = targets.find(item => item.personId === debt.personId);
        if (!target) return;
        target.assumedDebtValue = (target.assumedDebtValue || 0) + debt.value;
    });

    targets.forEach(t => {
        t.grossTargetValue = (t.totalTargetValue || 0) + (t.assumedDebtValue || 0);
        t.allocatedValue = (t.grossAllocatedValue || 0) - (t.assumedDebtValue || 0);
        const diff = t.allocatedValue - t.totalTargetValue;
        if (diff > 1) t.excessValue = diff;
        else if (diff < -1) t.underValue = Math.abs(diff);
    });

    const totalAssetsVal = currentAssets.reduce((s, a) => s + getAssetNetValue(a), 0) + totalColacao;
    const deedFees = getNotaryFees(safeSettings.selectedState, herancaLiquidaFisicaTotal);
    const registryFeesByState = new Map<UF, number>();
    currentAssets
        .filter(asset => asset.type === AssetType.IMOVEL && !isAssetAbroad(asset))
        .forEach(asset => {
            const state = asset.state || safeSettings.selectedState;
            const transmittedFactor = asset.origin === AssetOrigin.COMUM ? commonEstateFactor : privateEstateFactor;
            const transmittedValue = Math.max(0, getAssetNetValue(asset) * transmittedFactor);
            const fee = getNotaryFees(state, transmittedValue);
            registryFeesByState.set(state, (registryFeesByState.get(state) || 0) + fee.registry);
        });
    const totalRegistryFee = Array.from(registryFeesByState.values()).reduce((sum, value) => sum + value, 0);
    const taxableStates = new Set<UF>([
        ...Array.from(netCommonByState.keys()),
        ...Array.from(netPrivateByState.keys()),
    ]);
    const itcdBreakdown = Array.from(taxableStates)
        .map((state) => {
            const taxBase =
                ((netCommonByState.get(state) || 0) * commonEstateFactor) +
                ((netPrivateByState.get(state) || 0) * privateEstateFactor);

            if (taxBase <= 0) {
                return null;
            }

            const taxDetails = calculateItcdForState(state, taxBase, safeSettings, deceased.deathDate, 'CAUSA_MORTIS');

            return {
                state,
                taxBase,
                taxAmount: taxDetails.taxAmount,
                registryFee: registryFeesByState.get(state) || 0,
                assetCount: assetCountByState.get(state) || 0,
                effectiveRate: taxDetails.effectiveRate,
                legalText: taxDetails.legalText,
                discountApplied: taxDetails.discountApplied,
                originalTaxAmount: taxDetails.originalTaxAmount,
                discountValue: taxDetails.discountValue,
                // Sem estes três campos o cálculo persistido e o documento gerado no servidor
                // publicam o imposto sem nenhuma ressalva — a tabela pode ser referencial e o
                // consumidor não tem como saber.
                warningMessage: taxDetails.warningMessage,
                confiabilidade: taxDetails.confiabilidade,
                pendenciaHomologacao: taxDetails.pendenciaHomologacao,
                calculationMemory: taxDetails.calculationMemory,
            };
        })
        .filter((item): item is NonNullable<typeof item> => item !== null)
        .sort((a, b) => a.state.localeCompare(b.state));
    const totalTaxAmount = itcdBreakdown.reduce((sum, item) => sum + item.taxAmount, 0);

    // ITCD on unequal partition (donation). This mirrors the frontend's
    // allocation and competence rules so persisted calculations and reports
    // include the same donation events shown in the simulation.
    const donationBreakdown: DonationEvent[] = [];
    const donors = targets.filter(target => (target.underValue || 0) > 1);
    const donees = targets.filter(target => (target.excessValue || 0) > 1);
    const totalUnderValue = donors.reduce((sum, target) => sum + (target.underValue || 0), 0);
    // Rateio da doacao com valor liquido CLAMPADO em zero: um bem com passivo
    // BEM_VINCULADO maior que o proprio valor gera netValue negativo; o denominador
    // somava esses negativos mas as fatias negativas eram descartadas, entao a soma
    // das fatias ficava MAIOR que o transferido e o ITCD de doacao inflava (~25%).
    const getAssetNetValueForRateio = (asset: Parameters<typeof getAssetNetValue>[0]) => Math.max(0, getAssetNetValue(asset));
    const partitionedPatrimony = currentAssets.reduce((sum, asset) => sum + getAssetNetValueForRateio(asset), 0);

    const findHeirPerson = (personId: string) =>
        heirs.find(heir => heir.id === personId) || (personId === spouseId ? spousePerson : undefined);

    const getDomicile = (personId: string): { state: UF; abroad: boolean } => {
        const person = findHeirPerson(personId);
        return {
            state: person?.residenceState || safeSettings.selectedState,
            abroad: !!person?.domiciledAbroad,
        };
    };

    if (totalUnderValue > 0 && partitionedPatrimony > 0) {
        for (const donee of donees) {
            const doneeDomicile = getDomicile(donee.personId);

            for (const donor of donors) {
                const transfer = (donee.excessValue || 0) * ((donor.underValue || 0) / totalUnderValue);
                if (transfer <= 1) continue;

                const donorDomicile = getDomicile(donor.personId);
                const slicesByState = new Map<UF, { value: number; legalText: string; warning?: string }>();

                currentAssets.forEach(asset => {
                    const slice = transfer * (getAssetNetValueForRateio(asset) / partitionedPatrimony);
                    if (slice <= 0) return;

                    const isDomesticImmovable = asset.type === AssetType.IMOVEL && asset.location !== 'EXTERIOR';
                    let state: UF;
                    let legalText: string;
                    let warning: string | undefined;

                    if (isDomesticImmovable) {
                        state = asset.state || safeSettings.selectedState;
                        legalText = 'Doação (excesso) — imóvel no Brasil: competência da situação do bem (art. 158, I, LC 227/2026).';
                    } else if (!donorDomicile.abroad) {
                        state = donorDomicile.state;
                        legalText = 'Doação (excesso de meação/quinhão) — competência do domicílio do doador (art. 159, III / art. 158, II p/ imóvel no exterior, LC 227/2026).';
                    } else if (!doneeDomicile.abroad) {
                        state = doneeDomicile.state;
                        legalText = 'Doação (excesso) — doador no exterior: competência do domicílio do donatário (art. 159, IV / art. 158, III, LC 227/2026).';
                    } else {
                        state = safeSettings.selectedState;
                        legalText = 'Doação (excesso) — doador e donatário no exterior: competência da UF de localização do bem no Brasil (art. 159, V, LC 227/2026).';
                        warning = 'Doador e donatário no exterior: competência estimada pela UF do processo. Confirme a localização do bem no Brasil e a lei estadual aplicável (Tema 825/STF); se o bem estiver no exterior, a hipótese está fora do campo de incidência.';
                    }

                    const current = slicesByState.get(state) || { value: 0, legalText, warning };
                    current.value += slice;
                    if (warning) current.warning = warning;
                    slicesByState.set(state, current);
                });

                slicesByState.forEach((metadata, state) => {
                    if (metadata.value <= 1) return;

                    const tax = calculateItcdForState(
                        state,
                        metadata.value,
                        safeSettings,
                        deceased.deathDate,
                        'DOACAO'
                    );

                    donationBreakdown.push({
                        donorId: donor.personId,
                        donorName: donor.personName,
                        donorState: state,
                        receiverId: donee.personId,
                        receiverName: donee.personName,
                        value: metadata.value,
                        taxAmount: tax.taxAmount,
                        legalText: metadata.legalText,
                        // A ressalva do motor (alíquota de doação não homologada) viaja junto
                        // com a da competência; descartá-la calava o aviso no caminho da doação.
                        warningMessage: [tax.warningMessage, metadata.warning].filter(Boolean).join(' ') || undefined,
                        calculationMemory: tax.calculationMemory,
                    });
                });
            }
        }
    }

    const totalExcessTax = donationBreakdown.reduce((sum, event) => sum + event.taxAmount, 0);
    donees.forEach(donee => {
        donee.excessTax = donationBreakdown
            .filter(event => event.receiverId === donee.personId)
            .reduce((sum, event) => sum + event.taxAmount, 0);
    });

    return {
        totalAssets: totalAssetsVal,
        totalLiabilities: totalLiabilitiesValue,
        netEstate: successionBase,
        totalMeacao,
        herancaTotal: herancaLiquidaFisicaTotal,
        successionBase,
        disposablePortion,
        compulsoryPortion,
        // `testamentaryTotal` e o total DISPOSTO no testamento (antes da reducao do
        // art. 1.967), e nao o efetivamente atribuido: e dele que a tela tira o alerta
        // de inoficiosidade. Sem herdeiro necessario chamado nao ha legitima, e dispor
        // de todo o acervo e licito (art. 1.789).
        testamentaryTotal: testamentaryDisposed,
        isTestamentaryExcessive: hasCompulsoryHeirs && testamentaryDisposed > (disposablePortion + 0.1),
        taxBase: monteMorFisicoPartilhavel,
        taxAmount: totalTaxAmount,
        totalExcessTax,
        pendingEstateLiabilitiesTotal,
        projectedNetEstate,
        discountsApplied: [],
        targets,
        notaryFee: deedFees.deed + totalRegistryFee,
        deedFee: deedFees.deed,
        registryFee: totalRegistryFee,
        itcdBreakdown,
        donationBreakdown,
        estateSettlementItems: [],
        assetDebtSummary,
        liabilityReport: safeLiabilities.map(liability => ({
            liabilityId: liability.id,
            description: liability.description || 'Dívida',
            value: liability.value,
            treatment: liability.partitionTreatment,
            criterion: liability.distributionCriterion,
            responsibleHeirId: liability.responsibleHeirId,
            escrituraObservation: liability.escrituraObservation,
            assetLinks: (liability.assetLinks || []).map(link => ({
                assetId: link.assetId,
                deductedValue: link.deductedValue,
            })),
        }))
    };
};
