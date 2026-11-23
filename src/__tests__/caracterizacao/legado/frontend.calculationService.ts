
import {
  AssetOrigin,
  CalculationResult,
  HeirType,
  InventoryState,
  MaritalRegime,
  AllocationTarget,
  UF,
  AssetType,
  ItcdCompetenceRule,
  ItcdCompetenceInfo,
  DonationEvent,
} from './enums';
import {
  calculateItcdForState,
  calculateNotaryFees,
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
  ITCD_COMPETENCE_CHANGE_DATE,
  shouldSpouseCompeteWithDescendants,
  splitAmongAscendants,
  spouseShareWithAscendants,
  SuccessionExclusion,
  SuccessionHeir,
} from './nucleoCongelado';
import { getAssetEffectiveValue, resolveAssetValuationBasis } from './frontend.assetValuation';
import {
  buildAssetDebtSummary,
  buildAssumedHeirDebts,
  buildLiabilityReport,
  normalizeLiability,
} from './frontend.liabilityPartition';

// Núcleo da sucessão (vocação hereditária, representação, legítima, fatores de meação e
// rateio do passivo por UF) vive em @partilhamais/shared: era mantido em DUAS cópias à mão,
// aqui e no motor do backend, e as duas já divergiram. Nada dessas regras volta para cá.
export type { SuccessionExclusion };
type HeirLike = SuccessionHeir;

// Art. 1.840: o sobrinho só é chamado por representação quando o motor consegue ligá-lo ao
// irmão que ele representa, e esse vínculo não chega preenchido — o cadastro só pergunta o
// pai quando o parentesco é NETO. Sem `parentId` o núcleo descartava o sobrinho em silêncio
// e o quinhão do irmão pré-morto ia inteiro para o irmão vivo. Havendo UM único irmão a ser
// representado o vínculo é inequívoco (o sobrinho só é herdeiro por representá-lo) e é
// reconstruído aqui; com mais de um candidato, escolher um mudaria o direito de
// representação, então o sobrinho continua sem vínculo.
const linkNephewsToRepresentedSibling = (collaterals: HeirLike[]): HeirLike[] => {
  const orphanNephews = collaterals.filter(h => collateralDegree(h) === 3 && !h.parentId);
  if (orphanNephews.length === 0) return collaterals;

  // O renunciante não é representado (art. 1.811) e o irmão vivo herda por si: nenhum dos
  // dois é candidato a representado.
  const represented = collaterals.filter(
    h => collateralDegree(h) === 2 && !inheritsInOwnRight(h) && !isRenouncer(h)
  );
  if (represented.length !== 1) return collaterals;

  return collaterals.map(h =>
    orphanNephews.includes(h) ? { ...h, parentId: represented[0].id } : h
  );
};

// Marco de vigência da nova redação do art. 155, §1º, II, da CF (EC 132/2023). Reexportado
// porque a tela de ITCD (ItcdCalculationView) exibe a data ao usuário.
export { ITCD_COMPETENCE_CHANGE_DATE };

// Metadados de cada regra de competência, para exibição na tela e nos relatórios.
export const ITCD_COMPETENCE_RULES: Record<ItcdCompetenceRule, ItcdCompetenceInfo> = {
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
};

// Conjunto de regras que dependem de elemento de conexão no exterior (Tema 825/STF).
// A cobrança efetiva exige lei estadual/distrital válida + anterioridades.
const FOREIGN_CONNECTION_RULES: ReadonlySet<ItcdCompetenceRule> = new Set<ItcdCompetenceRule>([
  'IMOVEL_EXT_DOMICILIO_TITULAR',
  'IMOVEL_EXT_DOMICILIO_SUCESSOR',
  'MOVEL_EXT_DOMICILIO_SUCESSOR',
  'MOVEL_EXT_DOMICILIO_DONATARIO',
  'MOVEL_EXT_BEM_NO_BRASIL',
]);

export const isForeignConnectionRule = (rule: ItcdCompetenceRule): boolean =>
  FOREIGN_CONNECTION_RULES.has(rule);

// Um bem é considerado no exterior por `location` (imóveis) ou `otherDetails.locationType`.
const isAssetAbroad = (asset: { location?: string; otherDetails?: { locationType?: string } }): boolean =>
  asset.location === 'EXTERIOR' || asset.otherDetails?.locationType === 'EXTERIOR';

// Resolve o estado competente E a justificativa legal que o determinou.
// Cobre a matriz de sujeição ativa dos arts. 158/159 da LC 227/2026, incluindo
// os cenários com elemento de conexão no exterior (v1: domicílio do sucessor único).
export const resolveAssetItcdCompetence = (
  asset: { type: AssetType; state?: UF; location?: string; otherDetails?: { locationType?: string } },
  deceased: { deathDate?: string; lastResidenceState?: UF; domiciledAbroad?: boolean; successorDomicileState?: UF },
  settings: { selectedState: UF; itcdMovableState?: UF }
): { state: UF; competence: ItcdCompetenceInfo; warning?: string } => {
  const assetAbroad = isAssetAbroad(asset);
  // Quando o de cujus está no exterior a competência é do domicílio do sucessor; sem essa
  // UF informada não há como determiná-la — sinaliza-se em vez de assumir a UF do processo.
  const successorState = deceased.successorDomicileState || settings.selectedState;
  const successorWarning = deceased.successorDomicileState
    ? undefined
    : 'De cujus no exterior: informe a UF de domicílio do sucessor (aba Autor da Herança) para determinar a competência (arts. 158, III / 159, II, LC 227/2026). Enquanto não informada, usa-se provisoriamente a UF do processo.';

  // --- Imóveis (art. 158) ---
  if (asset.type === AssetType.IMOVEL) {
    if (!assetAbroad) {
      return {
        state: asset.state || settings.selectedState,
        competence: ITCD_COMPETENCE_RULES.IMOVEL_SITUS,
      };
    }
    // Imóvel no exterior.
    if (!deceased.domiciledAbroad) {
      return {
        state: deceased.lastResidenceState || settings.selectedState,
        competence: ITCD_COMPETENCE_RULES.IMOVEL_EXT_DOMICILIO_TITULAR,
      };
    }
    return {
      state: successorState,
      competence: ITCD_COMPETENCE_RULES.IMOVEL_EXT_DOMICILIO_SUCESSOR,
      warning: successorWarning,
    };
  }

  // --- Bens móveis, títulos e créditos (art. 159) ---
  // Regra histórica preservada para óbitos anteriores à EC 132/2023.
  if (isPreCompetenceChangeDeath(deceased.deathDate)) {
    return {
      // No inventário/escritura o processo é um só: o ITCD dos bens móveis (regra
      // histórica) segue o Estado do processo, que é o mesmo da escritura (selectedState).
      state: settings.selectedState,
      competence: ITCD_COMPETENCE_RULES.MOVEL_INVENTARIO_PROCESSO,
    };
  }

  // Causa mortis com de cujus no exterior → domicílio do sucessor (art. 159, II).
  if (deceased.domiciledAbroad) {
    return {
      state: successorState,
      competence: ITCD_COMPETENCE_RULES.MOVEL_EXT_DOMICILIO_SUCESSOR,
      warning: successorWarning,
    };
  }

  // Regra geral: domicílio do de cujus (art. 159, I).
  return {
    state: deceased.lastResidenceState || settings.selectedState,
    competence: ITCD_COMPETENCE_RULES.MOVEL_DOMICILIO_DE_CUJUS,
  };
};

export const resolveAssetItcdState = (
  asset: { type: AssetType; state?: UF },
  deceased: { deathDate?: string; lastResidenceState?: UF },
  settings: { selectedState: UF; itcdMovableState?: UF }
): UF => resolveAssetItcdCompetence(asset, deceased, settings).state;

export const calculatePartition = (data: InventoryState): CalculationResult => {
  const { assets, liabilities, deceased, heirs, settings, feeTables, feeMetadata } = data;
  const safeSettings = settings || { applyInventoryDiscount: false, selectedState: 'MG', itcdMovableState: 'MG', donationState: 'MG', assetValuationBasis: 'MARKET' };
  const valuationBasis = resolveAssetValuationBasis(safeSettings);

  // EMPTY_RESULT: Objeto de retorno seguro para evitar crashes quando não há dados
  const EMPTY_RESULT: CalculationResult = {
    totalAssets: 0, totalLiabilities: 0, netEstate: 0,
    totalMeacao: 0, herancaTotal: 0, successionBase: 0,
    disposablePortion: 0, compulsoryPortion: 0, testamentaryTotal: 0, 
    isTestamentaryExcessive: false, taxBase: 0, taxAmount: 0, 
    totalExcessTax: 0, pendingEstateLiabilitiesTotal: 0, projectedNetEstate: 0, discountsApplied: [], targets: [], 
    notaryFee: 0, deedFee: 0, registryFee: 0,
    itcdBreakdown: [], donationBreakdown: []
  };

  if (!assets || !heirs || !deceased) return EMPTY_RESULT;

  const currentAssets = assets.filter(a => a.type !== AssetType.ADIANTAMENTO);
  const advancements = assets.filter(a => a.type === AssetType.ADIANTAMENTO);

  /* 
   * Função auxiliar para calcular o valor real do bem considerando o percentual de propriedade
   * Se ownershipPercentage for undefined ou null, assume 100%
   */
  const getAssetValue = (asset: any) => {
    return getAssetEffectiveValue(asset, valuationBasis);
  };

  const normalizedLiabilities = (liabilities ?? []).map(normalizeLiability);
  const linkedAssetLiabilities = normalizedLiabilities.filter(
    liability => liability.partitionTreatment === 'BEM_VINCULADO'
  );
  const estateSettlementLiabilities = normalizedLiabilities.filter(
    liability => liability.partitionTreatment === 'ESPOLIO'
  );
  const assumedHeirLiabilities = normalizedLiabilities.filter(
    liability => liability.partitionTreatment === 'HERDEIRO_TORNA'
  );
  const assumedHeirDebts = buildAssumedHeirDebts(normalizedLiabilities);
  const assetDebtSummary = buildAssetDebtSummary(currentAssets as any, linkedAssetLiabilities as any, valuationBasis);
  const assetDebtSummaryMap = new Map(assetDebtSummary.map(item => [item.assetId, item]));

  const getAssetNetValue = (asset: any) => {
    return assetDebtSummaryMap.get(asset.id)?.netValue ?? getAssetValue(asset);
  };

  const getAssignedAssetValue = (asset: any, assignment: { percentage?: number; value?: number }) => {
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

  // Identifica o meeiro ANTES de calcular a meação: ela só existe se houver
  // cônjuge/companheiro(a). Antes isto era avaliado depois, e a meação era
  // descontada do monte só pelo regime — num inventário de viúvo(a), ou com o
  // regime preenchido antes do nome do cônjuge (inclusive pelo OCR da certidão
  // de casamento, que grava o regime sem o spouseName), metade do acervo sumia
  // sem ser atribuída a ninguém e o ITCD caía pela metade.
  const spousePerson = heirs.find(h => h.type === HeirType.CONJUGE || (h as any).isSpouse || h.id === 'spouse_auto');
  const hasSpouse = !!spousePerson || (!!deceased.spouseName && deceased.maritalRegime !== MaritalRegime.SOLTEIRO);

  let totalMeacao = 0;
  if (hasSpouse) {
    if (deceased.maritalRegime === MaritalRegime.COMUNHAO_UNIVERSAL) {
      totalMeacao = herancaLiquidaFisicaTotal * 0.5;
    } else if (deceased.maritalRegime === MaritalRegime.COMUNHAO_PARCIAL || deceased.maritalRegime === MaritalRegime.UNIAO_ESTAVEL || deceased.maritalRegime === MaritalRegime.SEPARACAO_OBRIGATORIA) {
      // Súmula 377 STF: No regime de separação legal (obrigatória), comunicam-se os bens adquiridos na constância do casamento (comuns).
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
  const getTarget = (pId: string, pName: string, pType: HeirType) => {
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

  // (spousePerson/hasSpouse já foram resolvidos antes do bloco da meação)
  const spouseId = spousePerson?.id ?? 'spouse_auto';
  const spouseName = spousePerson?.name ?? deceased.spouseName ?? 'Cônjuge';
  if (hasSpouse) getTarget(spouseId, spouseName, HeirType.CONJUGE).meacaoValue = totalMeacao;

  // Garantir que todos os herdeiros estejam nos targets para visualização
  // Herdeiros vivos recebem herança, pré-mortos são exibidos apenas para referência visual
  heirs.forEach(h => {
      if (h.id !== 'spouse_auto' && !(h as any).isSpouse) {
          getTarget(h.id, h.name, h.type);
      }
  });

  const allHeirs = heirs as unknown as HeirLike[];
  const descendants = allHeirs.filter(h => h.type === HeirType.DESCENDENTE);
  const ascendants = allHeirs.filter(h => h.type === HeirType.ASCENDENTE && !h.isPreDeceased && !isExcludedFromSuccession(h));
  const collaterals = allHeirs.filter(h => h.type === HeirType.COLATERAL);

  // As classes são montadas ANTES do testamento porque a redução das disposições
  // inoficiosas depende de existir herdeiro necessário chamado (art. 1.789).
  // `descendants` inclui os pré-mortos, mas só vira estirpe quem está vivo ou deixou
  // representantes. Com um único filho pré-morto e SEM netos, o ramo dos descendentes
  // era escolhido mesmo assim e `pool / stirpes.length` (zero) gerava Infinity/NaN:
  // todo o acervo desaparecia e os ascendentes nunca eram avaliados.
  const { stirpes } = buildDescendantSharesWithRepresentation(descendants);
  const { degree: calledAscendantDegree, called: calledAscendants } = callAscendants(ascendants);
  const collateralShares = buildCollateralShares(linkNephewsToRepresentedSibling(collaterals));

  // A renúncia não atinge a meação, que não é herança: o cônjuge renunciante segue
  // meeiro, mas não concorre na sucessão.
  const spouseInherits = hasSpouse && !(spousePerson && isExcludedFromSuccession(spousePerson as unknown as HeirLike));
  const hasCompulsoryHeirs = stirpes.length > 0 || calledAscendants.length > 0 || spouseInherits;

  let testamentaryTotal = 0;
  // Total disposto no testamento ANTES da redução — é ele que alimenta o alerta de
  // inoficiosidade e o botão de redução manual na tela.
  let testamentaryDisposed = 0;
  if (deceased.hasWill) {
    // Processar atribuições testamentárias de TODOS os herdeiros (não só TESTAMENTARIO)
    // Um herdeiro legítimo também pode receber legado/quota do testamento (parte disponível)
    const heirsWithTestament = heirs.filter(h =>
        h.type === HeirType.TESTAMENTARIO ||
        (h.testamentaryMode && (h.testamentaryPercentage || 0) > 0) ||
        (h.testamentaryMode === 'SPECIFIC_ASSETS')
    );
    type TestamentaryDisposition = { heir: (typeof heirsWithTestament)[number]; kind: 'QUOTA' | 'LEGADO'; value: number };
    const dispositions: TestamentaryDisposition[] = heirsWithTestament.flatMap<TestamentaryDisposition>(h => {
        if (h.testamentaryMode === 'PERCENTAGE_OF_ESTATE') {
            return [{ heir: h, kind: 'QUOTA' as const, value: successionBase * ((h.testamentaryPercentage || 0) / 100) }];
        }
        if (h.testamentaryMode === 'SPECIFIC_ASSETS') {
            const legacyValue = currentAssets.reduce((sum, asset) => {
                const testamentaryAssignment = asset.assignments.find(assignment =>
                    assignment.personId === h.id && assignment.lockReason === 'TESTAMENT'
                );
                return sum + (testamentaryAssignment ? getAssignedAssetValue(asset, testamentaryAssignment) : 0);
            }, 0);
            return [{ heir: h, kind: 'LEGADO' as const, value: legacyValue }];
        }
        return [];
    });

    testamentaryDisposed = dispositions.reduce((sum, d) => sum + d.value, 0);

    // Arts. 1.846/1.967: a legítima é intocável — o que exceder a parte disponível é
    // REDUZIDO antes do rateio, em vez de o testamentário ser servido primeiro pelo
    // valor integral e os necessários ficarem com o que sobrasse (podendo ser zero).
    // Sem herdeiro necessário chamado não há legítima a proteger (art. 1.789) e a
    // disposição vale integralmente, ainda que alcance todo o acervo.
    const disposableLimit = hasCompulsoryHeirs ? disposablePortion : testamentaryDisposed;
    const reduction = inofficiousReductionFactors(dispositions, disposableLimit);

    dispositions.forEach(d => {
        const value = d.value * (d.kind === 'QUOTA' ? reduction.quota : reduction.legacy);
        const target = getTarget(d.heir.id, d.heir.name, d.heir.type);
        target.theoreticalValue += value;
        target.testamentaryValue += value; // Decomposição: origem testamentária
        testamentaryTotal += value;
    });
  }

  // CORREÇÃO CRÍTICA: O pool disponível para os herdeiros legítimos é a Base Total menos o que foi testado
  // Isso corrige o erro de duplicidade onde remainingDisposable era somado incorretamente
  // Piso em zero: um legado/testamento maior que a base transmissível tornava
  // `availableForHeirs` NEGATIVO, e o valor negativo se propagava para os pools,
  // para os quinhões por estirpe e para `percentageOfEstate` — gerando quinhão
  // negativo e percentual fora de 0-100% em relatório e exportação.
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
      spouseTarget.theoreticalValue += spousePrivateShare;
      spouseTarget.legitimaValue += spousePrivateShare; // Decomposição: origem legítima (concorrência)
    } else if (spouseCompetes && !isPartial) {
      // SEPARAÇÃO TOTAL: cônjuge concorre em TODOS os bens (comum + particular)
      // Aplica reserva da 4ª parte quando há 4+ filhos (Art. 1832 CC)
      const numStirpes = stirpes.length;
      const totalPool = commonPool + privatePool; // Cônjuge concorre em TUDO
      const hasHybridDescendants = descendants.some(d => d.subtype === 'FILHO_UNILATERAL');
      
      let spouseTotalShare = 0;
      let stirpeTotalShare = 0;
      
      if (!hasHybridDescendants && numStirpes >= 4) {
        // Reserva da 4ª parte para o cônjuge
        spouseTotalShare = totalPool * 0.25;
        stirpeTotalShare = (totalPool - spouseTotalShare) / numStirpes;
      } else {
        // Divisão por cabeça
        spouseTotalShare = totalPool / (numStirpes + 1);
        stirpeTotalShare = spouseTotalShare;
      }
      
      const spouseTargetST = getTarget(spouseId, spouseName, HeirType.CONJUGE);
      spouseTargetST.theoreticalValue += spouseTotalShare;
      spouseTargetST.legitimaValue += spouseTotalShare; // Decomposição: origem legítima (concorrência)
      
      // Distribuir para os descendentes: o peso já traz a divisão por estirpe
      // (art. 1.855), inclusive nos graus mais remotos da representação.
      stirpes.forEach(st => {
        st.members.forEach(member => {
          const memberTarget = getTarget(member.heir.id, member.heir.name, HeirType.DESCENDENTE);
          memberTarget.theoreticalValue += stirpeTotalShare * member.weight;
          memberTarget.legitimaValue += stirpeTotalShare * member.weight; // Decomposição: origem legítima
        });
      });
      // Retornar para pular o bloco de distribuição abaixo (já foi feito)
      // A distribuição para Separação Total já foi feita acima, então não precisa do bloco comum abaixo
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
          memberTarget.theoreticalValue += totalStirpeShare * member.weight;
          memberTarget.legitimaValue += totalStirpeShare * member.weight; // Decomposição: origem legítima
        });
      });
    }
  } 
  else if (calledAscendants.length > 0) {
    // Só os ascendentes do grau mais próximo são chamados (art. 1.836, §1º); dentro
    // do grau, o rateio segue as linhas paterna e materna (§2º).
    let ascendantPool = availableForHeirs;
    if (spouseInherits) {
      const spouseRatio = spouseShareWithAscendants(calledAscendantDegree, calledAscendants.length);
      const spouseShare = availableForHeirs * spouseRatio;
      const spouseTargetAsc = getTarget(spouseId, spouseName, HeirType.CONJUGE);
      spouseTargetAsc.theoreticalValue += spouseShare;
      spouseTargetAsc.legitimaValue += spouseShare; // Decomposição: origem legítima (concorrência com ascendentes)
      ascendantPool = availableForHeirs - spouseShare;
    }
    const ascendantShares = splitAmongAscendants(calledAscendants, ascendantPool);
    calledAscendants.forEach(a => {
      const ascTarget = getTarget(a.id, a.name, HeirType.ASCENDENTE);
      const share = ascendantShares.get(a.id) || 0;
      ascTarget.theoreticalValue += share;
      ascTarget.legitimaValue += share; // Decomposição: origem legítima
    });
  }
  else if (spouseInherits) {
    const spouseTargetAlone = getTarget(spouseId, spouseName, HeirType.CONJUGE);
    spouseTargetAlone.theoreticalValue += availableForHeirs;
    spouseTargetAlone.legitimaValue += availableForHeirs; // Decomposição: origem legítima (herdeiro único)
  }
  else if (collateralShares.length > 0) {
    // O peso já embute o grau, a representação dos filhos de irmão e o dobro do
    // vínculo bilateral (arts. 1.840, 1.841, 1.843 e 1.853).
    const totalCollateralWeight = collateralShares.reduce((sum, m) => sum + m.weight, 0);
    collateralShares.forEach(member => {
      const colTarget = getTarget(member.heir.id, member.heir.name, HeirType.COLATERAL);
      const share = totalCollateralWeight > 0 ? availableForHeirs * (member.weight / totalCollateralWeight) : 0;
      colTarget.theoreticalValue += share;
      colTarget.legitimaValue += share; // Decomposição: origem legítima
    });
  }

  targets.forEach(t => {
    t.advancementValue = advancements.filter(a => a.beneficiaryId === t.personId).reduce((s, a) => s + getAssetValue(a), 0);
  });

  // Arts. 2.002/2.003: quando o adiantamento supera o quinhão, o excesso não pode
  // simplesmente desaparecer num `Math.max(0, ...)` — o donatário fica fora da
  // partilha dos bens remanescentes e o acervo físico restante é redividido entre os
  // demais, igualando os quinhões o quanto possível (art. 2.017). Antes, cada
  // herdeiro recebia `quinhão - adiantamento` com piso zero e a partilha chegava a
  // distribuir mais do que o acervo existente.
  const physicalToShare = targets.reduce((sum, t) => sum + (t.theoreticalValue - t.advancementValue), 0);
  let sharingTargets = [...targets];
  for (let pass = 0; pass <= targets.length; pass++) {
    const totalTheoretical = sharingTargets.reduce((sum, t) => sum + t.theoreticalValue, 0);
    if (totalTheoretical <= 0) {
      sharingTargets.forEach(t => { t.inheritanceValue = 0; });
      break;
    }
    // Quem continua na partilha traz o próprio adiantamento à colação; o de quem já
    // saiu fica fora da massa, porque ele nada mais recebe.
    const collated = sharingTargets.reduce((sum, t) => sum + t.advancementValue, 0);
    const mass = Math.max(0, physicalToShare) + collated;
    const allotment = (t: typeof targets[number]) => (mass * t.theoreticalValue) / totalTheoretical;
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

  const deedFees = calculateNotaryFees(safeSettings.selectedState, herancaLiquidaFisicaTotal, feeTables, feeMetadata);
  const registryFeesByState = new Map<UF, number>();
  currentAssets
    .filter(asset => asset.type === AssetType.IMOVEL && !isAssetAbroad(asset))
    .forEach(asset => {
      const state = asset.state || safeSettings.selectedState;
      const transmittedFactor = asset.origin === AssetOrigin.COMUM ? commonEstateFactor : privateEstateFactor;
      const transmittedValue = Math.max(0, getAssetNetValue(asset) * transmittedFactor);
      const fee = calculateNotaryFees(state, transmittedValue, feeTables, feeMetadata);
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

      // Competência dos bens atribuídos a este estado (justificativas + eventuais avisos).
      const stateCompetences = currentAssets
        .map((asset) => resolveAssetItcdCompetence(asset, deceased, safeSettings))
        .filter((c) => c.state === state);
      const competenceRules = Array.from(
        new Map(stateCompetences.map((c) => [c.competence.rule, c.competence] as const)).values()
      );
      const competenceWarnings = Array.from(
        new Set(stateCompetences.map((c) => c.warning).filter((w): w is string => !!w))
      );
      const warningMessage = [taxDetails.warningMessage, ...competenceWarnings]
        .filter((w): w is string => !!w)
        .join(' ') || undefined;

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
        warningMessage,
        // Sem o carimbo de confiabilidade a tela e o DOCX não têm como distinguir um valor
        // conferido de um referencial — os dois saem com a mesma cara de imposto devido.
        confiabilidade: taxDetails.confiabilidade,
        pendenciaHomologacao: taxDetails.pendenciaHomologacao,
        calculationMemory: taxDetails.calculationMemory,
        competenceRules,
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null)
    .sort((a, b) => a.state.localeCompare(b.state));

  const totalTaxAmount = itcdBreakdown.reduce((sum, item) => sum + item.taxAmount, 0);

  // ===== ITCD sobre excesso de meação/quinhão (doação) =====
  // O herdeiro que recebe além do seu quinhão teórico (excessValue) é donatário; os que
  // recebem aquém (underValue) são doadores. O excesso de cada donatário é distribuído entre
  // os doadores proporcionalmente ao respectivo underValue. A competência segue as regras de
  // doação (arts. 158/159, LC 227/2026), com rateio proporcional ao valor de cada bem no
  // patrimônio partilhado (item 5.4 do anexo): parcela de imóvel → situação do bem; parcela de
  // móvel → domicílio do doador (ou do donatário, se o doador estiver no exterior — art. 159, IV).
  const donationBreakdown: DonationEvent[] = [];
  const donors = targets.filter(t => (t.underValue || 0) > 1);
  const donees = targets.filter(t => (t.excessValue || 0) > 1);
  const totalUnderValue = donors.reduce((s, t) => s + (t.underValue || 0), 0);
  // Rateio da doação por bem: usa o valor líquido CLAMPADO em zero. Um bem com
  // passivo BEM_VINCULADO maior que o próprio valor produz netValue negativo; como
  // o denominador somava esses negativos mas as fatias negativas eram descartadas
  // (`slice <= 0`), a soma das fatias positivas ficava MAIOR que o valor transferido
  // e o ITCD de doação era inflado (até ~25%). Com o clamp, sum(slices) === transfer.
  const getAssetNetValueForRateio = (asset: unknown) => Math.max(0, getAssetNetValue(asset));
  const partitionedPatrimony = currentAssets.reduce((s, a) => s + getAssetNetValueForRateio(a), 0);

  const findHeirPerson = (personId: string) =>
    heirs.find(h => h.id === personId) || (personId === spouseId ? spousePerson : undefined);

  const getDomicile = (personId: string): { state: UF; abroad: boolean } => {
    const p = findHeirPerson(personId) as { residenceState?: UF; domiciledAbroad?: boolean } | undefined;
    return { state: p?.residenceState || safeSettings.selectedState, abroad: !!p?.domiciledAbroad };
  };

  if (totalUnderValue > 0 && partitionedPatrimony > 0) {
    for (const donee of donees) {
      const doneeDom = getDomicile(donee.personId);
      for (const donor of donors) {
        const transfer = (donee.excessValue || 0) * ((donor.underValue || 0) / totalUnderValue);
        if (transfer <= 1) continue;
        const donorDom = getDomicile(donor.personId);

        // Rateio por bem → estado competente da doação (arts. 158/159, item 5.4 do anexo).
        const sliceByState = new Map<UF, { value: number; legalText: string; warning?: string }>();
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
          } else if (!donorDom.abroad) {
            state = donorDom.state;
            legalText = 'Doação (excesso de meação/quinhão) — competência do domicílio do doador (art. 159, III / art. 158, II p/ imóvel no exterior, LC 227/2026).';
          } else if (!doneeDom.abroad) {
            state = doneeDom.state;
            legalText = 'Doação (excesso) — doador no exterior: competência do domicílio do donatário (art. 159, IV / art. 158, III, LC 227/2026).';
          } else {
            // Transmitente e donatário no exterior → UF de localização do bem no Brasil (art. 159, V).
            state = safeSettings.selectedState;
            legalText = 'Doação (excesso) — doador e donatário no exterior: competência da UF de localização do bem no Brasil (art. 159, V, LC 227/2026).';
            warning = 'Doador e donatário no exterior: competência estimada pela UF do processo. Confirme a localização do bem no Brasil e a lei estadual aplicável (Tema 825/STF); se o bem estiver no exterior, a hipótese está fora do campo de incidência.';
          }

          const cur = sliceByState.get(state) || { value: 0, legalText, warning };
          cur.value += slice;
          if (warning) cur.warning = warning;
          sliceByState.set(state, cur);
        });

        sliceByState.forEach((meta, state) => {
          if (meta.value <= 1) return;
          const tax = calculateItcdForState(state, meta.value, safeSettings, deceased.deathDate, 'DOACAO');
          donationBreakdown.push({
            donorId: donor.personId,
            donorName: donor.personName,
            donorState: state,
            receiverId: donee.personId,
            receiverName: donee.personName,
            value: meta.value,
            taxAmount: tax.taxAmount,
            legalText: meta.legalText,
            // A ressalva do motor (alíquota de doação não homologada) tem de viajar junto com
            // a da competência: descartá-la fazia o aviso morrer no motor para as 27 UFs.
            warningMessage: [tax.warningMessage, meta.warning].filter(Boolean).join(' ') || undefined,
            calculationMemory: tax.calculationMemory,
          });
        });
      }
    }
  }

  const totalExcessTax = donationBreakdown.reduce((s, e) => s + e.taxAmount, 0);
  donees.forEach(d => {
    d.excessTax = donationBreakdown
      .filter(e => e.receiverId === d.personId)
      .reduce((s, e) => s + e.taxAmount, 0);
  });

  return {
    totalAssets: totalAssetsVal, totalLiabilities: totalLiabilitiesValue, netEstate: successionBase,
    totalMeacao, herancaTotal: herancaLiquidaFisicaTotal, successionBase,
    // `testamentaryTotal` é o total DISPOSTO no testamento (antes da redução do art.
    // 1.967), e não o efetivamente atribuído: é dele que a tela tira o alerta de
    // inoficiosidade e o botão de redução manual. Sem herdeiro necessário chamado não
    // há legítima, e dispor de todo o acervo é lícito (art. 1.789).
    disposablePortion, compulsoryPortion, testamentaryTotal: testamentaryDisposed,
    isTestamentaryExcessive: hasCompulsoryHeirs && testamentaryDisposed > (disposablePortion + 0.1),
    taxBase: monteMorFisicoPartilhavel, taxAmount: totalTaxAmount, totalExcessTax, pendingEstateLiabilitiesTotal, projectedNetEstate,
    discountsApplied: [], targets, notaryFee: deedFees.deed + totalRegistryFee, deedFee: deedFees.deed, registryFee: totalRegistryFee,
    itcdBreakdown, donationBreakdown, estateSettlementItems: [], assetDebtSummary, liabilityReport: buildLiabilityReport(safeLiabilities)
  };
};
