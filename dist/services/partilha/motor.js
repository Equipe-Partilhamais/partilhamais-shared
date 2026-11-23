"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculatePartition = exports.PARTITION_ENGINE_VERSION = void 0;
const itcdStrategies_1 = require("../itcdStrategies");
const notaryFeeEngine_1 = require("../notaryFeeEngine");
const successionCore_1 = require("../successionCore");
const competencia_1 = require("./competencia");
const entrada_1 = require("./entrada");
const itcdPorBeneficiario_1 = require("./itcdPorBeneficiario");
const perfilUf_1 = require("../itcdStrategies/perfilUf");
const warnings_1 = require("../itcdStrategies/warnings");
const money_1 = require("../../utils/money");
const formatters_1 = require("../../utils/formatters");
const valoracao_1 = require("./valoracao");
// MOTOR DE PARTILHA — fonte única (CALC-09). Era `calculatePartition` em DUAS cópias mantidas
// à mão (frontend `services/calculationService.ts` e backend `src/lib/calculationService.ts`),
// que já divergiam. As decisões de reconciliação estão marcadas com "RECONCILIADO".
const CODIGO_DA_SITUACAO = {
    DIVERGENCIA_CONHECIDA: 'TABELA_DIVERGENCIA_CONHECIDA',
    PESQUISADA: 'TABELA_PESQUISADA_NAO_CONFERIDA',
    FAIXAS_ESTIMADAS: 'TABELA_FAIXAS_ESTIMADAS',
    REFERENCIA: 'TABELA_REFERENCIA',
};
/** Chave interna da massa de bens cujo ITCD é apurado por sucessor (nunca sai no resultado). */
const PELO_SUCESSOR = '*SUCESSOR';
/** Versão do motor: grave junto de todo cálculo persistido (snapshot da rota de cálculo). */
// .2: revisão de integração — ordem canônica (o centavo pode mudar de dono), cônjuge montado do
// falecido, visão, montes e testamento no resultado. Snapshot de versão anterior deve ser refeito.
exports.PARTITION_ENGINE_VERSION = 'shared-partilha-2026.11.19.2';
const DEFAULT_SETTINGS = {
    applyInventoryDiscount: false,
    selectedState: 'MG',
    itcdMovableState: 'MG',
    donationState: 'MG',
    assetValuationBasis: 'MARKET',
};
/** CALC-08: soma monetária em centavos inteiros (independe da ordem e do resíduo binário). */
const somaReais = (valores) => (0, money_1.fromCents)(valores.reduce((s, v) => s + (0, money_1.toCents)(v), 0));
/** Herdeiro no formato do núcleo sucessório: `null` vira ausente. */
const toSuccessionHeir = (h) => ({
    id: h.id,
    name: h.name,
    type: h.type,
    subtype: h.subtype ?? undefined,
    isPreDeceased: h.isPreDeceased ?? undefined,
    parentId: h.parentId ?? undefined,
    testamentaryMode: h.testamentaryMode ?? undefined,
    testamentaryPercentage: h.testamentaryPercentage ?? undefined,
    successionExclusion: h.successionExclusion ?? undefined,
    ascendantLine: h.ascendantLine ?? undefined,
    siblingBond: h.siblingBond ?? undefined,
});
// Art. 1.840: o sobrinho só é chamado por representação quando o motor consegue ligá-lo ao
// irmão que ele representa, e esse vínculo não chega preenchido — o cadastro só pergunta o pai
// quando o parentesco é NETO. Havendo UM único irmão a ser representado o vínculo é inequívoco
// e é reconstruído aqui; com mais de um candidato, escolher um mudaria o direito de
// representação, então o sobrinho continua sem vínculo.
const linkNephewsToRepresentedSibling = (collaterals) => {
    const orphanNephews = collaterals.filter(h => (0, successionCore_1.collateralDegree)(h) === 3 && !h.parentId);
    if (orphanNephews.length === 0)
        return collaterals;
    const represented = collaterals.filter(h => (0, successionCore_1.collateralDegree)(h) === 2 && !(0, successionCore_1.inheritsInOwnRight)(h) && !(0, successionCore_1.isRenouncer)(h));
    if (represented.length !== 1)
        return collaterals;
    return collaterals.map(h => (orphanNephews.includes(h) ? { ...h, parentId: represented[0].id } : h));
};
const emptyResult = () => ({
    totalAssets: 0, totalLiabilities: 0, netEstate: 0,
    totalMeacao: 0, herancaTotal: 0, successionBase: 0,
    disposablePortion: 0, compulsoryPortion: 0, testamentaryTotal: 0, monteLiquido: 0, passivoDoEspolioNaHeranca: 0,
    isTestamentaryExcessive: false, taxBase: 0, taxAmount: 0,
    totalExcessTax: 0, pendingEstateLiabilitiesTotal: 0, projectedNetEstate: 0, discountsApplied: [], targets: [],
    notaryFee: 0, deedFee: 0, registryFee: 0, notaryFeeStatus: 'TABLES_UNAVAILABLE',
    itcdBreakdown: [], itcdPorBeneficiario: [], atribuicoes: [], donationBreakdown: [],
    estateSettlementItems: [], assetDebtSummary: [], liabilityReport: [],
    itcdIndeterminado: false, avisos: [], minuta: { exigeConfirmacao: false, motivos: [] }, engineVersion: exports.PARTITION_ENGINE_VERSION,
    visao: { baseDeAvaliacao: 'MARKET', filtroDeBens: 'TODOS', bensForaDaPartilha: [] },
    montes: {
        bensBrutos: 0, passivoVinculado: 0, passivoAssumidoPorHerdeiros: 0, herancaFisica: 0, meacao: 0, montePartilhavel: 0,
        colacao: 0, monteComColacao: 0, passivoDoEspolio: 0, passivoDoEspolioNaHeranca: 0, monteLiquido: 0,
    },
    testamento: { disponivel: 0, dispostoLiquido: 0, atribuidoBruto: 0, fatorQuota: 1, fatorLegado: 1, disposicoes: [] },
});
const calculatePartition = (data) => calcular(data, false).resultado;
exports.calculatePartition = calculatePartition;
/**
 * `semPassivo` = chamada interna que refaz o caso sem o passivo, só para obter os quinhões legais
 * sobre o valor bruto (pesos de reserva do ITCD quando a herança líquida é zero — revisão d).
 */
function calcular(data, semPassivo) {
    if (!data)
        return { resultado: emptyResult(), pesosLivres: [] };
    if (!data.assets || !data.heirs || !data.deceased)
        return { resultado: emptyResult(), pesosLivres: [] };
    const deceased = data.deceased;
    const settings = data.settings || DEFAULT_SETTINGS;
    // Revisão de integração (2): a visão da partilha é ENTRADA explícita. Padrão: base de
    // avaliação de `settings.assetValuationBasis` (ou mercado) e todos os bens.
    const valuationBasis = (0, valoracao_1.resolveAssetValuationBasis)({ assetValuationBasis: data.visao?.baseDeAvaliacao ?? settings.assetValuationBasis });
    const filtroDeBens = data.visao?.filtroDeBens === 'PARTILHA_OFICIAL' ? 'PARTILHA_OFICIAL' : 'TODOS';
    const bensForaDaPartilha = filtroDeBens === 'PARTILHA_OFICIAL' ? data.assets.filter(a => !(0, entrada_1.isAssetIncludedInOfficialPartition)(a)) : [];
    // Revisão de integração (1): o resultado não pode depender da ordem de entrada — o servidor
    // ordena por id e a tela por criação, e o centavo do rateio ia para o primeiro da lista. Tudo
    // é processado em ordem canônica (por id); só `targets` volta na ordem de entrada, para a tela.
    const porId = (xs) => [...xs].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    const porPessoa = (xs) => xs ? [...xs].sort((a, b) => (a.personId < b.personId ? -1 : a.personId > b.personId ? 1 : (a.percentage ?? -1) - (b.percentage ?? -1) || (a.value ?? 0) - (b.value ?? 0))) : xs;
    const assets = porId(data.assets.filter(a => !bensForaDaPartilha.includes(a))).map(a => ({ ...a, assignments: porPessoa(a.assignments) }));
    // Revisão de integração (3): o cônjuge sai do falecido (`spouseQualification`) e de qualquer
    // cadastro de cônjuge — a mesma montagem que os apps podem chamar antes.
    const heirs = porId((0, entrada_1.montarConjugeDaEntrada)(deceased, data.heirs));
    const ordemDeEntrada = new Map(data.heirs.map((h, i) => [h.id, i]));
    const feeTables = data.feeTables ?? undefined;
    const feeMetadata = data.feeMetadata ?? undefined;
    const deathDate = deceased.deathDate ?? undefined;
    const currentAssets = assets.filter(a => a.type !== 'ADIANTAMENTO');
    const advancements = assets.filter(a => a.type === 'ADIANTAMENTO');
    // CALC-08: valor de cada bem já em centavos (a titularidade parcial gera fração de centavo).
    const getAssetValue = (asset) => (0, money_1.roundMoney)((0, valoracao_1.getAssetEffectiveValue)(asset, valuationBasis));
    const normalizedLiabilities = porId(data.liabilities ?? [])
        .map(l => ({ ...l, assetLinks: l.assetLinks ? [...l.assetLinks].sort((a, b) => (a.assetId < b.assetId ? -1 : a.assetId > b.assetId ? 1 : 0)) : l.assetLinks }))
        .map(valoracao_1.normalizeLiability);
    const estateSettlementLiabilities = normalizedLiabilities.filter(l => l.partitionTreatment === 'ESPOLIO');
    const assumedHeirLiabilities = normalizedLiabilities.filter(l => l.partitionTreatment === 'HERDEIRO_TORNA');
    const assumedHeirDebts = (0, valoracao_1.buildAssumedHeirDebts)(normalizedLiabilities);
    const assetDebtSummary = (0, valoracao_1.buildAssetDebtSummary)(currentAssets, normalizedLiabilities, getAssetValue);
    const assetDebtSummaryMap = new Map(assetDebtSummary.map(item => [item.assetId, item]));
    const getAssetNetValue = (asset) => assetDebtSummaryMap.get(asset.id)?.netValue ?? getAssetValue(asset);
    const getAssignedAssetValue = (asset, assignment) => {
        const pct = assignment?.percentage;
        if (typeof pct === 'number' && Number.isFinite(pct))
            return (getAssetNetValue(asset) * pct) / 100;
        return assignment?.value || 0;
    };
    const commonAssetsByState = new Map();
    const privateAssetsByState = new Map();
    const assetCountByState = new Map();
    const competenceByAsset = new Map(currentAssets.map(asset => [asset.id, (0, competencia_1.resolveAssetItcdCompetence)(asset, deceased, settings)]));
    // Revisão 2: bem cuja competência é do domicílio de cada sucessor (de cujus no exterior) entra
    // numa massa à parte, que o ITCD reparte depois pela UF de residência de cada sucessor.
    const chaveDoBem = (asset) => {
        const c = competenceByAsset.get(asset.id);
        return c.porSucessor ? PELO_SUCESSOR : c.state;
    };
    // CALC-05: o mesmo acervo por UF ANTES de qualquer dívida — base das UFs cuja lei manda não
    // abater dívida nenhuma (SP, Lei 10.705/2000, art. 12).
    const commonGrossByState = new Map();
    const privateGrossByState = new Map();
    currentAssets.forEach(asset => {
        const state = chaveDoBem(asset);
        const value = getAssetNetValue(asset);
        const targetMap = asset.origin === 'COMUM' ? commonAssetsByState : privateAssetsByState;
        targetMap.set(state, (targetMap.get(state) || 0) + value);
        const grossMap = asset.origin === 'COMUM' ? commonGrossByState : privateGrossByState;
        grossMap.set(state, (grossMap.get(state) || 0) + Math.max(0, getAssetValue(asset)));
        assetCountByState.set(state, (assetCountByState.get(state) || 0) + 1);
    });
    // CALC-08: somas monetárias feitas em centavos inteiros — não dependem da ordem das parcelas
    // nem carregam o resíduo binário que, no meio centavo, decide o arredondamento da meação.
    const commonAssetsVal = somaReais(currentAssets.filter(a => a.origin === 'COMUM').map(getAssetNetValue));
    const privateAssetsVal = somaReais(currentAssets.filter(a => a.origin === 'PARTICULAR').map(getAssetNetValue));
    const totalColacao = somaReais(advancements.map(getAssetValue));
    const totalDebtCommon = somaReais(assumedHeirLiabilities.filter(l => l.origin === 'COMUM').map(l => l.value || 0));
    const totalDebtPrivate = somaReais(assumedHeirLiabilities.filter(l => l.origin === 'PARTICULAR').map(l => l.value || 0));
    const pendingEstateLiabilitiesTotal = somaReais(estateSettlementLiabilities.map(l => l.value || 0));
    const totalLiabilitiesValue = somaReais(normalizedLiabilities.map(l => l.value || 0));
    const netCommon = Math.max(0, (0, money_1.roundMoney)(commonAssetsVal - totalDebtCommon));
    const netPrivate = Math.max(0, (0, money_1.roundMoney)(privateAssetsVal - totalDebtPrivate));
    const herancaLiquidaFisicaTotal = somaReais([netCommon, netPrivate]);
    const projectedNetEstate = Math.max(0, (0, money_1.roundMoney)(herancaLiquidaFisicaTotal - pendingEstateLiabilitiesTotal));
    // RECONCILIADO (CALC-09): o backend só reconhecia o meeiro por `type === CONJUGE`. O
    // frontend aceitava também `isSpouse` e o id `spouse_auto` (o meeiro reconstruído a partir
    // do `deceased`). Um cônjuge gravado só com `isSpouse` era excluído dos alvos E não era
    // achado como meeiro no servidor. Vale a versão do frontend.
    const prioridadeDoConjuge = (h) => (h.id === 'spouse_auto' ? 0 : h.isSpouse ? 1 : 2);
    const spousePerson = heirs
        .filter(h => h.type === 'CONJUGE' || !!h.isSpouse || h.id === 'spouse_auto')
        .sort((a, b) => prioridadeDoConjuge(a) - prioridadeDoConjuge(b))[0];
    const hasSpouse = !!spousePerson || (!!deceased.spouseName && deceased.maritalRegime !== 'SOLTEIRO');
    const regime = deceased.maritalRegime;
    // Meação só sobre o COMUM, em todo regime que a tem. CALC-02: na comunhão universal ela era
    // calculada sobre a herança inteira (`herancaLiquidaFisicaTotal * 0.5`), alcançando o bem
    // particular — que nesse regime só existe nas hipóteses de exclusão do art. 1.668.
    // Súmula 377/STF: na separação obrigatória comunicam-se os aquestos.
    let totalMeacao = 0;
    if (hasSpouse &&
        (regime === 'COMUNHAO_UNIVERSAL' || regime === 'COMUNHAO_PARCIAL' || regime === 'UNIAO_ESTAVEL' || regime === 'SEPARACAO_OBRIGATORIA')) {
        // CALC-08: meio centavo vai ao meeiro (ROUND_HALF_UP) e o resto exato ao monte.
        totalMeacao = (0, money_1.roundMoney)(netCommon * 0.5);
    }
    const avisos = [];
    const particularesNaUniversal = hasSpouse && regime === 'COMUNHAO_UNIVERSAL' ? currentAssets.filter(a => a.origin === 'PARTICULAR') : [];
    if (particularesNaUniversal.length > 0) {
        // O formulário deixa marcar "Particular" em qualquer regime. Na comunhão universal o bem
        // só é particular nas hipóteses de exclusão — e, sendo, não tem meação. Avisa para o
        // advogado conferir a origem: marcado por engano, ele mudaria a meação e o ITCD.
        avisos.push({
            codigo: 'COMUNHAO_UNIVERSAL_COM_BEM_PARTICULAR',
            categoria: 'REGIME_DE_BENS',
            gravidade: 'ATENCAO',
            mensagem: 'Comunhão universal com bem marcado como particular: ele fica fora da meação e vai inteiro aos herdeiros ' +
                '(o cônjuge não concorre com descendentes nesse regime). Confira se o bem se enquadra numa das exclusões do ' +
                'art. 1.668 do Código Civil (doação ou herança com cláusula de incomunicabilidade, sub-rogados, bens de uso ' +
                'pessoal etc.); se não se enquadrar, marque-o como comum.',
            fundamento: 'CC, arts. 1.667, 1.668 e 1.829, I',
            bens: particularesNaUniversal.map(a => a.id),
        });
    }
    const monteMorFisicoPartilhavel = (0, money_1.fromCents)((0, money_1.toCents)(herancaLiquidaFisicaTotal) - (0, money_1.toCents)(totalMeacao));
    const successionBase = somaReais([monteMorFisicoPartilhavel, totalColacao]);
    const commonEstateFactor = (0, successionCore_1.getCommonEstateFactor)(regime, hasSpouse);
    const privateEstateFactor = (0, successionCore_1.getPrivateEstateFactor)(regime, hasSpouse);
    const netCommonByState = (0, successionCore_1.allocateDebtByState)(commonAssetsByState, totalDebtCommon);
    const netPrivateByState = (0, successionCore_1.allocateDebtByState)(privateAssetsByState, totalDebtPrivate);
    // CALC-04: legítima e disponível sobre o monte LÍQUIDO (CC, art. 1.847: "abatidas as dívidas
    // e as despesas do funeral"). O passivo do espólio era só exibido como "pendente", e o
    // testamento era confrontado com o monte bruto — um legado que consumia a legítima passava
    // como "não excessivo". A dívida é rateada entre as massas: a de origem comum onera o comum
    // (e a meação suporta metade dela), a particular só a herança; sem origem informada, na
    // proporção dos acervos.
    let passivoEspolioComum = 0;
    let passivoEspolioParticular = 0;
    estateSettlementLiabilities.forEach(l => {
        const valor = l.value || 0;
        if (l.origin === 'COMUM')
            passivoEspolioComum += valor;
        else if (l.origin === 'PARTICULAR')
            passivoEspolioParticular += valor;
        else if (netCommon + netPrivate > 0) {
            passivoEspolioComum += (valor * netCommon) / (netCommon + netPrivate);
            passivoEspolioParticular += (valor * netPrivate) / (netCommon + netPrivate);
        }
        else
            passivoEspolioParticular += valor;
    });
    const passivoDoEspolioNaHeranca = (0, money_1.roundMoney)(passivoEspolioComum * commonEstateFactor + passivoEspolioParticular * privateEstateFactor);
    const monteLiquido = Math.max(0, (0, money_1.fromCents)((0, money_1.toCents)(monteMorFisicoPartilhavel) - (0, money_1.toCents)(passivoDoEspolioNaHeranca)));
    // Parte disponível = monte líquido / 2 (sem colação); legítima = monte líquido / 2 + colação.
    // CALC-08: disponível + (legítima − colação) = monte líquido, ao centavo.
    const disposablePortion = (0, money_1.roundMoney)(monteLiquido * 0.5);
    const compulsoryPortion = (0, money_1.fromCents)((0, money_1.toCents)(monteLiquido) - (0, money_1.toCents)(disposablePortion) + (0, money_1.toCents)(totalColacao));
    // Base da quota testamentária ("X% da herança"): a herança líquida, com a colação como antes.
    const baseDaQuotaTestamentaria = Math.max(0, (0, money_1.fromCents)((0, money_1.toCents)(successionBase) - (0, money_1.toCents)(passivoDoEspolioNaHeranca)));
    if (passivoDoEspolioNaHeranca > 0 && monteLiquido > 0) {
        avisos.push({
            codigo: 'LEGITIMA_SOBRE_MONTE_LIQUIDO',
            categoria: 'LEGITIMA',
            gravidade: 'INFORMATIVO',
            mensagem: `Legítima e parte disponível calculadas sobre o monte líquido: ${(0, formatters_1.formatCurrency)(monteMorFisicoPartilhavel)} ` +
                `menos ${(0, formatters_1.formatCurrency)(passivoDoEspolioNaHeranca)} do passivo do espólio = ${(0, formatters_1.formatCurrency)(monteLiquido)}. ` +
                'Os quinhões são exibidos antes da quitação do passivo, que é suportado pelos herdeiros legítimos e pelos de quota ' +
                'na proporção dos quinhões (art. 1.997) — ver `passivoDoEspolio` de cada um; o legatário de bem certo não responde.',
            fundamento: 'CC, arts. 1.792, 1.847 e 1.997',
            valores: { monteBruto: monteMorFisicoPartilhavel, passivoNaHeranca: passivoDoEspolioNaHeranca, monteLiquido },
        });
    }
    // Herança (sem a meação) que vem da massa comum e da particular. `rho` é a fração comum.
    // Os motores antigos usavam `netCommon * 0.5 / monte`, que só acerta quando há meação sobre
    // o comum; os quinhões não dependiam disso, mas o rateio do ITCD por UF depende (CALC-01).
    const herancaComum = netCommon * commonEstateFactor;
    const herancaParticular = netPrivate * privateEstateFactor;
    const rho = herancaComum + herancaParticular > 0 ? herancaComum / (herancaComum + herancaParticular) : 0;
    // Fração comum do que se reparte DEPOIS dos legados de bem certo (recalculada após o testamento).
    let rhoPartilha = rho;
    // De que massa vem o quinhão de cada um. O cônjuge na comunhão parcial só herda dos
    // particulares (art. 1.829, I): sem este registro ele seria contribuinte do ITCD também na
    // UF onde só há bens comuns, que ele recebe por meação e não por herança.
    const massaDoQuinhao = new Map();
    const registrarMassa = (personId, comum, particular) => {
        const atual = massaDoQuinhao.get(personId) || { comum: 0, particular: 0 };
        atual.comum += comum;
        atual.particular += particular;
        massaDoQuinhao.set(personId, atual);
    };
    const targets = [];
    const getTarget = (personId, personName, personType) => {
        let t = targets.find(item => item.personId === personId);
        if (!t) {
            t = {
                personId, personName, personType,
                meacaoValue: 0, theoreticalValue: 0, advancementValue: 0, inheritanceValue: 0,
                legitimaValue: 0, testamentaryValue: 0,
                totalTargetValue: 0, percentageOfEstate: 0, grossTargetValue: 0, grossAllocatedValue: 0,
                assumedDebtValue: 0, allocatedValue: 0, excessValue: 0, underValue: 0, excessTax: 0, fracaoDoMonte: null,
                passivoDoEspolio: 0, liquidoProjetado: 0,
            };
            targets.push(t);
        }
        return t;
    };
    /** Quinhão legítimo. Sem massa indicada, vem das duas na proporção da herança. */
    const addLegitimateShare = (target, value, massa) => {
        target.theoreticalValue += value;
        target.legitimaValue += value;
        registrarMassa(target.personId, massa ? massa.comum : value * rhoPartilha, massa ? massa.particular : value * (1 - rhoPartilha));
    };
    const spouseId = spousePerson?.id ?? 'spouse_auto';
    const spouseName = spousePerson?.name ?? deceased.spouseName ?? 'Cônjuge';
    if (hasSpouse)
        getTarget(spouseId, spouseName, 'CONJUGE').meacaoValue = totalMeacao;
    heirs.forEach(h => {
        if (h.id !== 'spouse_auto' && !h.isSpouse)
            getTarget(h.id, h.name, h.type);
    });
    const allHeirs = heirs.map(toSuccessionHeir);
    const descendants = allHeirs.filter(h => h.type === 'DESCENDENTE');
    const ascendants = allHeirs.filter(h => h.type === 'ASCENDENTE' && !h.isPreDeceased && !(0, successionCore_1.isExcludedFromSuccession)(h));
    const collaterals = allHeirs.filter(h => h.type === 'COLATERAL');
    // Classes montadas ANTES do testamento: a redução das disposições inoficiosas depende de
    // existir herdeiro necessário chamado (art. 1.789).
    const { stirpes } = (0, successionCore_1.buildDescendantSharesWithRepresentation)(descendants);
    const { degree: calledAscendantDegree, called: calledAscendants } = (0, successionCore_1.callAscendants)(ascendants);
    const collateralShares = (0, successionCore_1.buildCollateralShares)(linkNephewsToRepresentedSibling(collaterals));
    // A renúncia não atinge a meação, que não é herança: o cônjuge renunciante segue meeiro.
    const spouseInherits = hasSpouse && !(spousePerson && (0, successionCore_1.isExcludedFromSuccession)(toSuccessionHeir(spousePerson)));
    const hasCompulsoryHeirs = stirpes.length > 0 || calledAscendants.length > 0 || spouseInherits;
    // ===== Revisão 3: incoerência entre regime de bens e cônjuge/companheiro =====
    // O cálculo NÃO muda aqui: o regime e o cadastro decidem meação e concorrência, e o motor segue
    // o que foi informado. Só a incoerência passa a aparecer — e trava a minuta quando altera a
    // partilha. O modelo não tem tipo próprio de companheiro (companheiro = cônjuge com regime de
    // união estável), por isso não há como acusar "companheiro sem união estável" em separado.
    const candidatosAConjuge = heirs.filter(h => h.type === 'CONJUGE' || !!h.isSpouse || h.id === 'spouse_auto');
    const semRegimeDeCasamento = !regime || regime === 'SOLTEIRO';
    const temBemComum = currentAssets.some(a => a.origin === 'COMUM');
    if (semRegimeDeCasamento && (candidatosAConjuge.length > 0 || !!deceased.spouseName)) {
        const conjugeIgnorado = !spousePerson && !hasSpouse;
        // Com descendentes, o regime decide se o cônjuge concorre (CC, art. 1.829, I); com bem comum,
        // decide a meação; cônjuge informado só pelo nome e ignorado muda tudo. Sem nada disso (só
        // particulares, sem descendentes) o cônjuge herda igual em qualquer regime (art. 1.829, II e III).
        const mudaAPartilha = conjugeIgnorado || stirpes.length > 0 || temBemComum;
        avisos.push({
            codigo: 'CONJUGE_SEM_REGIME_DE_BENS',
            categoria: 'REGIME_DE_BENS',
            gravidade: mudaAPartilha ? 'EXIGE_CONFIRMACAO' : 'ATENCAO',
            mensagem: (conjugeIgnorado
                ? `O nome do cônjuge (${deceased.spouseName}) foi informado, mas o regime está como ${regime || 'não informado'}: o cônjuge ` +
                    'foi IGNORADO no cálculo (sem meação e sem herança). '
                : `Cônjuge cadastrado com regime de bens ${regime ? '"SOLTEIRO"' : 'não informado'}: o cálculo não atribuiu meação ` +
                    'e não o fez concorrer com os descendentes. ') +
                'Informe o regime de bens do casamento ou da união estável (ou retire o cônjuge, se o falecido não era casado nem ' +
                'convivente) — ele decide a meação e a concorrência (CC, arts. 1.658 a 1.688, 1.725 e 1.829).',
            fundamento: 'CC, arts. 1.725 e 1.829',
            pessoas: candidatosAConjuge.map(h => h.id),
        });
    }
    const marcadosSoPorIsSpouse = heirs.filter(h => !!h.isSpouse && h.type !== 'CONJUGE' && h.id !== 'spouse_auto');
    if (marcadosSoPorIsSpouse.length > 0) {
        avisos.push({
            codigo: 'CONJUGE_MARCADO_SO_POR_ISSPOUSE',
            categoria: 'REGIME_DE_BENS',
            gravidade: 'EXIGE_CONFIRMACAO',
            mensagem: `${marcadosSoPorIsSpouse.map(h => h.name).join(', ')} está marcado(a) como cônjuge/meeiro(a), mas cadastrado(a) com o tipo ` +
                `${Array.from(new Set(marcadosSoPorIsSpouse.map(h => h.type))).join('/')}: o cálculo o(a) tratou como cônjuge (meação e ` +
                'concorrência). Confirme o parentesco no cadastro antes de gerar a minuta.',
            fundamento: 'CC, arts. 1.829 e 1.830',
            pessoas: marcadosSoPorIsSpouse.map(h => h.id),
        });
    }
    if (candidatosAConjuge.length > 1) {
        avisos.push({
            codigo: 'MAIS_DE_UM_CONJUGE',
            categoria: 'REGIME_DE_BENS',
            gravidade: 'EXIGE_CONFIRMACAO',
            mensagem: `Há ${candidatosAConjuge.length} cadastros como cônjuge/meeiro (${candidatosAConjuge.map(h => h.name).join(', ')}); o cálculo ` +
                `usou só o primeiro (${spousePerson?.name}). Deixe um único cônjuge ou companheiro no cadastro.`,
            fundamento: 'CC, arts. 1.829 e 1.830',
            pessoas: candidatosAConjuge.map(h => h.id),
        });
    }
    if (!semRegimeDeCasamento && !hasSpouse) {
        avisos.push({
            codigo: 'REGIME_SEM_CONJUGE_CADASTRADO',
            categoria: 'REGIME_DE_BENS',
            gravidade: 'ATENCAO',
            mensagem: `Regime de bens ${regime} informado sem cônjuge ou companheiro cadastrado: não foi calculada meação. Se o falecido era ` +
                'viúvo, divorciado ou separado, está correto; se o cônjuge sobrevivente existe, cadastre-o — ele tem meação e pode ' +
                'herdar (CC, art. 1.829).',
            fundamento: 'CC, art. 1.829',
        });
    }
    let testamentaryTotal = 0;
    // Revisão de integração (5): fatores do art. 1.967, § 1º, por disposição, para o app gravar
    // exatamente o que o motor calcula (o app reduzia quota e legado pelo mesmo fator).
    let fatoresDeReducao = { quota: 1, legado: 1 };
    const disposicoesDoTestamento = [];
    // Revisão (a): legados de bem certo, já reduzidos. O ITCD de cada um vai para a UF do PRÓPRIO
    // bem; só o que não é legado específico se rateia por todas as UFs.
    const legados = [];
    const legadosLimitados = [];
    // Quotas registradas depois que se souber de que massa saíram os legados (proporção abaixo).
    const quotasARegistrar = [];
    // Total DISPOSTO no testamento (em valor líquido), antes da redução: alimenta o alerta de
    // inoficiosidade.
    let testamentaryDisposed = 0;
    if (deceased.hasWill) {
        // Disposições de TODOS os herdeiros: um herdeiro legítimo também pode ser legatário.
        const withTestament = heirs.filter(h => h.type === 'TESTAMENTARIO' ||
            (!!h.testamentaryMode && (h.testamentaryPercentage || 0) > 0) ||
            h.testamentaryMode === 'SPECIFIC_ASSETS');
        const dispositions = withTestament.flatMap(h => {
            const pct = (h.testamentaryPercentage || 0) / 100;
            if (h.testamentaryMode === 'PERCENTAGE_OF_ESTATE') {
                return [{ heir: h, kind: 'QUOTA', liquido: baseDaQuotaTestamentaria * pct, bruto: successionBase * pct, itens: [] }];
            }
            if (h.testamentaryMode === 'SPECIFIC_ASSETS') {
                // Só a atribuição travada PELO TESTAMENTO é legado.
                // Revisão 2 — CC, art. 1.914: se a coisa legada só em parte pertencer ao testador, só
                // quanto a essa parte valerá o legado. Em bem COMUM com meação, a parte do falecido é a
                // metade dele; a meação do cônjuge sobre o bem fica com o cônjuge.
                const itens = currentAssets.flatMap(asset => {
                    const asg = (asset.assignments || []).find(a => a.personId === h.id && a.lockReason === 'TESTAMENT');
                    if (!asg)
                        return [];
                    const legado = getAssignedAssetValue(asset, asg);
                    const parteDoTestador = asset.origin === 'COMUM' && hasSpouse && commonEstateFactor < 1
                        ? Math.max(0, getAssetNetValue(asset)) * commonEstateFactor
                        : Number.POSITIVE_INFINITY;
                    const valor = Math.min(legado, parteDoTestador);
                    if (legado - valor > 0.005)
                        legadosLimitados.push({ personId: h.id, assetId: asset.id, antes: legado, depois: valor });
                    return [{ asset, valor, legado, percentual: typeof asg.percentage === 'number' && Number.isFinite(asg.percentage) ? asg.percentage : null }];
                });
                const total = itens.reduce((sum, item) => sum + item.valor, 0);
                return [{ heir: h, kind: 'LEGADO', liquido: total, bruto: total, itens }];
            }
            return [];
        });
        testamentaryDisposed = dispositions.reduce((sum, d) => sum + d.liquido, 0);
        // Arts. 1.846/1.967: o que exceder a disponível é REDUZIDO antes do rateio. Sem herdeiro
        // necessário chamado não há legítima a proteger (art. 1.789).
        const disposableLimit = hasCompulsoryHeirs ? disposablePortion : testamentaryDisposed;
        const reduction = (0, successionCore_1.inofficiousReductionFactors)(dispositions.map(d => ({ kind: d.kind, value: d.liquido })), disposableLimit);
        fatoresDeReducao = { quota: reduction.quota, legado: reduction.legacy };
        const quatroCasas = (x) => Math.round(x * 10000) / 10000;
        dispositions.forEach(d => {
            const fator = d.kind === 'QUOTA' ? reduction.quota : reduction.legacy;
            const pct = d.heir.testamentaryPercentage ?? null;
            disposicoesDoTestamento.push({
                personId: d.heir.id,
                tipo: d.kind,
                percentual: d.kind === 'QUOTA' ? pct : null,
                dispostoLiquido: (0, money_1.roundMoney)(d.liquido),
                dispostoBruto: (0, money_1.roundMoney)(d.bruto),
                fatorDeReducao: fator,
                percentualAposReducao: d.kind === 'QUOTA' && pct !== null ? quatroCasas(pct * fator) : null,
                valorAposReducao: (0, money_1.roundMoney)(d.bruto * fator),
                itens: d.itens.map(item => ({
                    assetId: item.asset.id,
                    percentualOriginal: item.percentual,
                    valorLegado: (0, money_1.roundMoney)(item.legado),
                    valorValido: (0, money_1.roundMoney)(item.valor),
                    valorAposReducao: (0, money_1.roundMoney)(item.valor * fator),
                    percentualAposReducao: item.percentual !== null && item.legado > 0 ? quatroCasas((item.percentual * item.valor * fator) / item.legado) : null,
                })),
            });
        });
        dispositions.forEach(d => {
            const fator = d.kind === 'QUOTA' ? reduction.quota : reduction.legacy;
            const value = d.bruto * fator;
            const target = getTarget(d.heir.id, d.heir.name, d.heir.type);
            target.theoreticalValue += value;
            target.testamentaryValue += value;
            testamentaryTotal += value;
            if (d.kind === 'QUOTA')
                quotasARegistrar.push({ personId: target.personId, valor: value });
            else
                d.itens.forEach(item => legados.push({ personId: target.personId, asset: item.asset, valor: item.valor * fator }));
        });
    }
    // Revisão 2: o legado de bem certo sai da massa do próprio bem (comum ou particular); o que
    // sobra das duas massas é que se reparte entre quota, legítima e concorrência do cônjuge. Antes
    // o testamento era tirado das duas massas na proporção do monte, e o cônjuge que só concorre nos
    // particulares (art. 1.829, I) perdia parte do quinhão por um legado de bem comum.
    const legadoComum = legados.filter(l => l.asset.origin === 'COMUM').reduce((s, l) => s + l.valor, 0);
    const legadoParticular = legados.filter(l => l.asset.origin !== 'COMUM').reduce((s, l) => s + l.valor, 0);
    const restoComum = Math.max(0, herancaComum - legadoComum);
    const restoParticular = Math.max(0, herancaParticular - legadoParticular);
    rhoPartilha = restoComum + restoParticular > 0 ? restoComum / (restoComum + restoParticular) : rho;
    quotasARegistrar.forEach(q => registrarMassa(q.personId, q.valor * rhoPartilha, q.valor * (1 - rhoPartilha)));
    if (legadosLimitados.length > 0) {
        const antes = (0, money_1.roundMoney)(legadosLimitados.reduce((s, l) => s + l.antes, 0));
        const depois = (0, money_1.roundMoney)(legadosLimitados.reduce((s, l) => s + l.depois, 0));
        avisos.push({
            codigo: 'LEGADO_LIMITADO_A_PARTE_DO_TESTADOR',
            categoria: 'LEGITIMA',
            gravidade: 'ATENCAO',
            mensagem: `Legado de bem comum: o testador só dispõe da própria parte, e o legado vale só quanto a ela (CC, art. 1.914) — ` +
                `${(0, formatters_1.formatCurrency)(antes)} legados, ${(0, formatters_1.formatCurrency)(depois)} válidos. A meação do cônjuge sobre o bem fica com o ` +
                'cônjuge: ajuste a atribuição do bem na partilha, que não pode destinar ao legatário a metade do cônjuge.',
            fundamento: 'CC, art. 1.914',
            pessoas: Array.from(new Set(legadosLimitados.map(l => l.personId))),
            bens: Array.from(new Set(legadosLimitados.map(l => l.assetId))),
            valores: { antes, depois },
        });
    }
    // CALC-04: inoficiosidade confrontada com a disponível LÍQUIDA. A redução automática acima
    // muda o que o testamento diz; a minuta não pode sair com isso sem o advogado confirmar.
    const isTestamentaryExcessive = hasCompulsoryHeirs && testamentaryDisposed > disposablePortion + 0.1;
    if (isTestamentaryExcessive) {
        const excesso = testamentaryDisposed - disposablePortion;
        avisos.push({
            codigo: 'DISPOSICAO_INOFICIOSA',
            categoria: 'LEGITIMA',
            gravidade: 'EXIGE_CONFIRMACAO',
            mensagem: `As disposições testamentárias (${(0, formatters_1.formatCurrency)(testamentaryDisposed)}) excedem a parte disponível ` +
                `(${(0, formatters_1.formatCurrency)(disposablePortion)}) em ${(0, formatters_1.formatCurrency)(excesso)}. O cálculo já as reduziu — primeiro as ` +
                'quotas, depois os legados (art. 1.967, § 1º) —, mas a redução das disposições inoficiosas precisa constar ' +
                'da minuta e ser aceita pelos interessados ou decidida pelo juízo.',
            fundamento: 'CC, arts. 1.789, 1.846, 1.847, 1.966 e 1.967',
            pessoas: targets.filter(t => t.testamentaryValue > 0).map(t => t.personId),
            valores: { disponivel: disposablePortion, disposto: testamentaryDisposed, excesso },
        });
    }
    // Piso em zero: disposição maior que a base não pode gerar quinhão negativo.
    const availableForHeirs = Math.max(0, successionBase - testamentaryTotal);
    if (stirpes.length > 0) {
        const hasPrivateAssets = netPrivate > 0;
        const spouseCompetes = spouseInherits && (0, successionCore_1.shouldSpouseCompeteWithDescendants)(regime, hasPrivateAssets);
        const isPartial = regime === 'COMUNHAO_PARCIAL' || regime === 'UNIAO_ESTAVEL';
        const commonPool = availableForHeirs * rhoPartilha;
        const privatePool = availableForHeirs * (1 - rhoPartilha);
        let stirpePrivateShare = 0;
        const numStirpes = stirpes.length;
        const hasHybridDescendants = descendants.some(d => d.subtype === 'FILHO_UNILATERAL');
        if (spouseCompetes && isPartial) {
            // Comunhão parcial / união estável: o cônjuge concorre só nos PARTICULARES (art. 1.829, I).
            let spousePrivateShare;
            if (!hasHybridDescendants && numStirpes >= 4) {
                spousePrivateShare = privatePool * 0.25;
                stirpePrivateShare = (privatePool - spousePrivateShare) / numStirpes;
            }
            else {
                spousePrivateShare = privatePool / (numStirpes + 1);
                stirpePrivateShare = spousePrivateShare;
            }
            addLegitimateShare(getTarget(spouseId, spouseName, 'CONJUGE'), spousePrivateShare, { comum: 0, particular: spousePrivateShare });
        }
        else if (spouseCompetes && !isPartial) {
            // Separação total: o cônjuge concorre em tudo, com a reserva da 4ª parte (art. 1.832).
            const totalPool = commonPool + privatePool;
            let spouseTotalShare;
            let stirpeTotalShare;
            if (!hasHybridDescendants && numStirpes >= 4) {
                spouseTotalShare = totalPool * 0.25;
                stirpeTotalShare = (totalPool - spouseTotalShare) / numStirpes;
            }
            else {
                spouseTotalShare = totalPool / (numStirpes + 1);
                stirpeTotalShare = spouseTotalShare;
            }
            addLegitimateShare(getTarget(spouseId, spouseName, 'CONJUGE'), spouseTotalShare);
            stirpes.forEach(st => st.members.forEach(member => addLegitimateShare(getTarget(member.heir.id, member.heir.name, 'DESCENDENTE'), stirpeTotalShare * member.weight)));
        }
        else {
            stirpePrivateShare = privatePool / numStirpes;
        }
        const isSeparacaoTotal = regime === 'SEPARACAO_TOTAL';
        if (!isSeparacaoTotal || !spouseCompetes) {
            const stirpeCommonShare = commonPool / numStirpes;
            stirpes.forEach(st => {
                const totalStirpeShare = stirpePrivateShare + stirpeCommonShare;
                st.members.forEach(member => addLegitimateShare(getTarget(member.heir.id, member.heir.name, 'DESCENDENTE'), totalStirpeShare * member.weight, {
                    comum: stirpeCommonShare * member.weight,
                    particular: stirpePrivateShare * member.weight,
                }));
            });
        }
    }
    else if (calledAscendants.length > 0) {
        let ascendantPool = availableForHeirs;
        if (spouseInherits) {
            const spouseShare = availableForHeirs * (0, successionCore_1.spouseShareWithAscendants)(calledAscendantDegree, calledAscendants.length);
            addLegitimateShare(getTarget(spouseId, spouseName, 'CONJUGE'), spouseShare);
            ascendantPool = availableForHeirs - spouseShare;
        }
        const ascendantShares = (0, successionCore_1.splitAmongAscendants)(calledAscendants, ascendantPool);
        calledAscendants.forEach(a => addLegitimateShare(getTarget(a.id, a.name, 'ASCENDENTE'), ascendantShares.get(a.id) || 0));
    }
    else if (spouseInherits) {
        addLegitimateShare(getTarget(spouseId, spouseName, 'CONJUGE'), availableForHeirs);
    }
    else if (collateralShares.length > 0) {
        const totalWeight = collateralShares.reduce((sum, m) => sum + m.weight, 0);
        collateralShares.forEach(member => addLegitimateShare(getTarget(member.heir.id, member.heir.name, 'COLATERAL'), totalWeight > 0 ? availableForHeirs * (member.weight / totalWeight) : 0));
    }
    targets.forEach(t => {
        t.advancementValue = somaReais(advancements.filter(a => a.beneficiaryId === t.personId).map(getAssetValue));
    });
    // Arts. 2.002/2.003 e 2.017: o donatário cujo adiantamento supera o quinhão sai da partilha
    // dos bens remanescentes, que são redivididos entre os demais.
    const physicalToShare = targets.reduce((sum, t) => sum + (t.theoreticalValue - t.advancementValue), 0);
    let sharingTargets = [...targets];
    for (let pass = 0; pass <= targets.length; pass++) {
        const totalTheoretical = sharingTargets.reduce((sum, t) => sum + t.theoreticalValue, 0);
        if (totalTheoretical <= 0) {
            sharingTargets.forEach(t => { t.inheritanceValue = 0; });
            break;
        }
        const collated = sharingTargets.reduce((sum, t) => sum + t.advancementValue, 0);
        const mass = Math.max(0, physicalToShare) + collated;
        const allotment = (t) => (mass * t.theoreticalValue) / totalTheoretical;
        const overEndowed = sharingTargets.filter(t => t.advancementValue > allotment(t) + 0.005);
        if (overEndowed.length === 0) {
            sharingTargets.forEach(t => { t.inheritanceValue = Math.max(0, allotment(t) - t.advancementValue); });
            break;
        }
        overEndowed.forEach(t => { t.inheritanceValue = 0; });
        sharingTargets = sharingTargets.filter(t => !overEndowed.includes(t));
    }
    // ===== CALC-08: quinhões em centavos =====
    // Até aqui o rateio é em ponto flutuante (as frações da lei: 1/3, 1/4 do art. 1.832, pesos de
    // estirpe). Agora cada componente vai a centavo pelo MAIOR RESTO, de modo que as partes somem
    // exatamente o todo — 7 × R$ 14.285,72 = R$ 100.000,04 para um monte de R$ 100.000,01 era o
    // que a minuta imprimia. A fração do monte sai como razão ("1/7") quando ela existe.
    const fracoes = targets.map(t => (successionBase > 0 ? (0, money_1.toFraction)(t.theoreticalValue / successionBase) : null));
    // Revisão (e): o percentual sai da fração LEGAL (valor exato antes do arredondamento), não dos
    // centavos já arredondados — 1/4 de R$ 1.599,61 dava R$ 399,90 e 24,9998%.
    const teoricoExato = targets.map(t => t.theoreticalValue);
    const n = targets.length;
    const componentes = (0, money_1.distributeCents)((0, money_1.toCents)(targets.reduce((s, t) => s + t.legitimaValue + t.testamentaryValue, 0)), [...targets.map(t => t.legitimaValue), ...targets.map(t => t.testamentaryValue)]);
    const herancas = (0, money_1.distributeCents)((0, money_1.toCents)(targets.reduce((s, t) => s + t.inheritanceValue, 0)), targets.map(t => t.inheritanceValue));
    targets.forEach((t, i) => {
        t.legitimaValue = (0, money_1.fromCents)(componentes[i]);
        t.testamentaryValue = (0, money_1.fromCents)(componentes[n + i]);
        t.theoreticalValue = (0, money_1.fromCents)(componentes[i] + componentes[n + i]);
        t.inheritanceValue = (0, money_1.fromCents)(herancas[i]);
        t.fracaoDoMonte = fracoes[i];
    });
    // Percentual com 4 casas, também pelo maior resto: 7 × 14,2857% somava 99,9999%.
    const unidadesDePercentual = (0, money_1.distributeCents)(successionBase > 0 ? Math.round((teoricoExato.reduce((s, v) => s + v, 0) / successionBase) * 1000000) : 0, teoricoExato);
    targets.forEach((t, i) => {
        t.totalTargetValue = somaReais([t.meacaoValue, t.inheritanceValue]);
        t.grossTargetValue = t.totalTargetValue;
        t.percentageOfEstate = unidadesDePercentual[i] / 10000;
    });
    // Atribuição de cada bem em centavos: as partes de um bem somam o valor dele.
    // Revisão 4: cada atribuição sai no resultado (`atribuicoes`), com o valor bruto (antes da dívida
    // vinculada) e o líquido, exatamente como entram no `grossAllocatedValue` — o frontend precisava
    // refazer este rateio para montar a minuta, o que é regra de cálculo fora do motor.
    const atribuicoesDoResultado = [];
    const alocadoCentavos = new Map();
    // Rateio pelo maior resto que também aceita total negativo (bem com dívida maior que o valor).
    const ratearComSinal = (total, pesos) => total < 0 ? (0, money_1.distributeCents)(-total, pesos).map(c => -c) : (0, money_1.distributeCents)(total, pesos);
    currentAssets.forEach(asset => {
        const atribuicoes = asset.assignments || [];
        const comPercentual = atribuicoes.filter(a => typeof a.percentage === 'number' && Number.isFinite(a.percentage));
        const liquido = getAssetNetValue(asset);
        const bruto = getAssetValue(asset);
        const pesos = comPercentual.map(a => a.percentage);
        const somaPct = pesos.reduce((s, p) => s + p, 0);
        const partesLiquidas = comPercentual.length > 0 ? ratearComSinal((0, money_1.toCents)((liquido * somaPct) / 100), pesos) : [];
        const partesBrutas = comPercentual.length > 0 ? ratearComSinal((0, money_1.toCents)((bruto * somaPct) / 100), pesos) : [];
        comPercentual.forEach((a, i) => {
            alocadoCentavos.set(a.personId, (alocadoCentavos.get(a.personId) || 0) + partesLiquidas[i]);
            atribuicoesDoResultado.push({
                assetId: asset.id,
                personId: a.personId,
                percentage: a.percentage,
                fracao: (0, money_1.toFraction)(a.percentage / 100),
                valorBruto: (0, money_1.fromCents)(partesBrutas[i]),
                valorLiquido: (0, money_1.fromCents)(partesLiquidas[i]),
                lockReason: a.lockReason ?? undefined,
            });
        });
        // Atribuição só por valor (sem percentual): vale o valor informado, nos dois campos.
        atribuicoes
            .filter(a => !comPercentual.includes(a))
            .forEach(a => {
            const centavos = (0, money_1.toCents)(getAssignedAssetValue(asset, a));
            alocadoCentavos.set(a.personId, (alocadoCentavos.get(a.personId) || 0) + centavos);
            atribuicoesDoResultado.push({
                assetId: asset.id,
                personId: a.personId,
                percentage: null,
                fracao: null,
                valorBruto: (0, money_1.fromCents)(centavos),
                valorLiquido: (0, money_1.fromCents)(centavos),
                lockReason: a.lockReason ?? undefined,
            });
        });
    });
    targets.forEach(t => { t.grossAllocatedValue = (0, money_1.fromCents)(alocadoCentavos.get(t.personId) || 0); });
    assumedHeirDebts.forEach(debt => {
        const target = targets.find(item => item.personId === debt.personId);
        if (target)
            target.assumedDebtValue = somaReais([target.assumedDebtValue, debt.value]);
    });
    targets.forEach(t => {
        t.grossTargetValue = somaReais([t.totalTargetValue, t.assumedDebtValue]);
        t.allocatedValue = (0, money_1.fromCents)((0, money_1.toCents)(t.grossAllocatedValue) - (0, money_1.toCents)(t.assumedDebtValue));
        const diff = (0, money_1.fromCents)((0, money_1.toCents)(t.allocatedValue) - (0, money_1.toCents)(t.totalTargetValue));
        if (diff > 1)
            t.excessValue = diff;
        else if (diff < -1)
            t.underValue = Math.abs(diff);
    });
    // Revisão (b): quem suporta o passivo do espólio na partilha exibida antes da quitação. Os
    // sucessores a título universal (herdeiros legítimos e de quota) na proporção do que recebem
    // (CC, art. 1.997); o legatário de bem certo não — salvo se não houver mais ninguém (herança
    // insuficiente). A meação suporta a metade da dívida comum.
    const legadoPorPessoa = new Map();
    legados.forEach(l => legadoPorPessoa.set(l.personId, (legadoPorPessoa.get(l.personId) || 0) + l.valor));
    const parteLivre = (t) => Math.max(0, t.inheritanceValue - (legadoPorPessoa.get(t.personId) || 0));
    {
        const pesosUniversais = targets.map(parteLivre);
        const pesos = pesosUniversais.some(p => p > 0) ? pesosUniversais : targets.map(t => t.inheritanceValue);
        const totalCentavos = (0, money_1.toCents)(pendingEstateLiabilitiesTotal);
        const naHerancaCentavos = Math.min(totalCentavos, (0, money_1.toCents)(passivoDoEspolioNaHeranca));
        const partes = (0, money_1.distributeCents)(naHerancaCentavos, pesos);
        targets.forEach((t, i) => {
            const daMeacao = hasSpouse && t.personId === spouseId ? totalCentavos - naHerancaCentavos : 0;
            t.passivoDoEspolio = (0, money_1.fromCents)(partes[i] + daMeacao);
            t.liquidoProjetado = (0, money_1.fromCents)(Math.max(0, (0, money_1.toCents)(t.totalTargetValue) - partes[i] - daMeacao));
        });
    }
    const totalAssetsVal = somaReais([...currentAssets.map(getAssetNetValue), totalColacao]);
    // RECONCILIADO (CALC-09): o backend usava as próprias tabelas de emolumentos e o frontend as
    // recebia da API. Agora as tabelas são ENTRADA do motor (`feeTables`/`feeMetadata`): o
    // backend passa as suas, o frontend as que recebeu, e a ausência delas aparece no
    // `notaryFeeStatus` em vez de virar R$ 0,00 com cara de emolumento.
    const deedFees = (0, notaryFeeEngine_1.calculateNotaryFees)(settings.selectedState, herancaLiquidaFisicaTotal, feeTables, feeMetadata);
    const deedFee = (0, money_1.roundMoney)(deedFees.deed);
    if (deedFees.status !== 'CALCULATED') {
        avisos.push({
            codigo: 'EMOLUMENTOS_NAO_CALCULADOS',
            categoria: 'EMOLUMENTOS',
            gravidade: 'ATENCAO',
            mensagem: `Emolumentos não calculados (${deedFees.rangeLabel}): escritura e registro aparecem como R$ 0,00 por falta ` +
                'de tabela, e não por isenção. Recarregue as tabelas ou informe os valores do cartório.',
            ufs: [settings.selectedState],
        });
    }
    const registryFeesByState = new Map();
    currentAssets
        .filter(asset => asset.type === 'IMOVEL' && !(0, competencia_1.isAssetAbroad)(asset))
        .forEach(asset => {
        const state = asset.state || settings.selectedState;
        const factor = asset.origin === 'COMUM' ? commonEstateFactor : privateEstateFactor;
        const fee = (0, notaryFeeEngine_1.calculateNotaryFees)(state, Math.max(0, getAssetNetValue(asset) * factor), feeTables, feeMetadata);
        registryFeesByState.set(state, somaReais([registryFeesByState.get(state) || 0, (0, money_1.roundMoney)(fee.registry)]));
    });
    const totalRegistryFee = somaReais(Array.from(registryFeesByState.values()));
    const itcdSettings = { applyInventoryDiscount: !!settings.applyInventoryDiscount };
    const taxableStates = new Set([...Array.from(netCommonByState.keys()), ...Array.from(netPrivateByState.keys())]);
    // ===== Base do ITCD por UF e por beneficiário =====
    // CALC-01: peso de cada beneficiário em cada massa = o que ele de fato recebe do monte
    // (`inheritanceValue`, já descontada a colação), repartido entre comum e particular na
    // proporção de onde veio o quinhão. A meação fica fora: não é transmissão.
    // Revisão (a): o legado de bem certo NÃO entra nesse rateio — vai inteiro para a UF do bem.
    const pesosDe = (lista) => lista
        .map(t => {
        const massa = massaDoQuinhao.get(t.personId);
        const total = massa ? massa.comum + massa.particular : 0;
        const livre = parteLivre(t);
        if (!massa || total <= 0 || livre <= 0)
            return null;
        return {
            personId: t.personId,
            personName: t.personName,
            personType: t.personType,
            comum: (livre * massa.comum) / total,
            particular: (livre * massa.particular) / total,
        };
    })
        .filter((p) => p !== null);
    const pesosLivres = pesosDe(targets);
    // Revisão (d): herança líquida zero (dívida vinculada maior que o bem, por exemplo) deixava
    // todos os pesos em zero; numa UF que não abate dívida (SP) a base bruta existia e o motor
    // dizia "cadastre os herdeiros" com o herdeiro cadastrado. Sem peso líquido nenhum, o rateio
    // usa os quinhões LEGAIS calculados sobre o valor bruto (o mesmo caso, sem o passivo).
    const precisaReserva = !semPassivo && pesosLivres.length === 0 && legados.length === 0 && currentAssets.some(a => getAssetValue(a) > 0);
    const pesosDeReserva = precisaReserva ? calcular({ ...data, liabilities: [] }, true).pesosLivres : [];
    const pesosDoRateio = pesosLivres.length > 0 ? pesosLivres : pesosDeReserva;
    const usouPesosDeReserva = pesosLivres.length === 0 && pesosDeReserva.length > 0;
    const somaPesoComum = pesosDoRateio.reduce((s, p) => s + p.comum, 0);
    const somaPesoParticular = pesosDoRateio.reduce((s, p) => s + p.particular, 0);
    // Massa sem ninguém que a receba (todos os quinhões vindo da outra) cai na proporção da
    // outra massa, para não sumir base.
    const fracaoNaMassa = (p, massa) => {
        const [propria, outra, somaPropria, somaOutra] = massa === 'comum'
            ? [p.comum, p.particular, somaPesoComum, somaPesoParticular]
            : [p.particular, p.comum, somaPesoParticular, somaPesoComum];
        return somaPropria > 0 ? propria / somaPropria : somaOutra > 0 ? outra / somaOutra : 0;
    };
    const fatorDa = (m) => (m === 'comum' ? commonEstateFactor : privateEstateFactor);
    const ehDaMassa = (a, m) => (m === 'comum' ? a.origin === 'COMUM' : a.origin !== 'COMUM');
    const mapaDa = (leitura, m) => leitura === 'BRUTA'
        ? m === 'comum' ? commonGrossByState : privateGrossByState
        : m === 'comum' ? netCommonByState : netPrivateByState;
    const valorNaLeitura = (a, leitura) => Math.max(0, leitura === 'BRUTA' ? getAssetValue(a) : getAssetNetValue(a));
    // Revisão (a): parte de cada bem legado que sai para o legatário, como fração da herança
    // contida nele (a meação fica fora). Na leitura INTEGRAL o legado não suporta a dívida do
    // espólio — ela abate só a parte livre, a dos sucessores universais (CC, art. 1.997).
    const fracaoLegada = legados.map(l => {
        const m = l.asset.origin === 'COMUM' ? 'comum' : 'particular';
        const heranca = Math.max(0, getAssetNetValue(l.asset)) * fatorDa(m);
        return { ...l, massa: m, state: chaveDoBem(l.asset), fracao: heranca > 0 ? Math.min(1, l.valor / heranca) : 0 };
    });
    const legadosNaMassa = (state, m, leitura) => {
        const daMassa = currentAssets.filter(a => ehDaMassa(a, m) && chaveDoBem(a) === state);
        const pesoTotal = daMassa.reduce((sum, a) => sum + valorNaLeitura(a, leitura), 0);
        const base = Math.max(0, (mapaDa(leitura, m).get(state) || 0) * fatorDa(m));
        return fracaoLegada
            .filter(l => l.massa === m && l.state === state)
            .map(l => ({ personId: l.personId, valor: pesoTotal > 0 ? l.fracao * base * (valorNaLeitura(l.asset, leitura) / pesoTotal) : 0 }));
    };
    const livreNaMassa = (state, m, leitura) => Math.max(0, Math.max(0, (mapaDa(leitura, m).get(state) || 0) * fatorDa(m)) -
        legadosNaMassa(state, m, leitura).reduce((sum, l) => sum + l.valor, 0));
    const livreIntegral = (m) => {
        const livreTratamento = new Map();
        taxableStates.forEach(state => livreTratamento.set(state, livreNaMassa(state, m, 'TRATAMENTO')));
        return (0, successionCore_1.allocateDebtByState)(livreTratamento, (m === 'comum' ? passivoEspolioComum : passivoEspolioParticular) * fatorDa(m));
    };
    const livreIntegralComum = livreIntegral('comum');
    const livreIntegralParticular = livreIntegral('particular');
    const montarUf = (state, leitura) => {
        const quanto = new Map();
        const somar = (personId, valor) => quanto.set(personId, (quanto.get(personId) || 0) + valor);
        let semDono = 0;
        ['comum', 'particular'].forEach(m => {
            legadosNaMassa(state, m, leitura === 'BRUTA' ? 'BRUTA' : 'TRATAMENTO').forEach(l => somar(l.personId, l.valor));
            const livre = leitura === 'INTEGRAL'
                ? (m === 'comum' ? livreIntegralComum : livreIntegralParticular).get(state) || 0
                : livreNaMassa(state, m, leitura);
            if (livre <= 0)
                return;
            const fracoes = pesosDoRateio.map(p => ({ p, f: fracaoNaMassa(p, m) })).filter(x => x.f > 0);
            if (fracoes.length === 0)
                semDono += livre;
            else
                fracoes.forEach(({ p, f }) => somar(p.personId, livre * f));
        });
        const total = Array.from(quanto.values()).reduce((sum, v) => sum + v, 0);
        return { quanto, total, semDono };
    };
    const nomeDe = new Map([...targets, ...pesosDeReserva].map(p => [p.personId, { personName: p.personName, personType: p.personType }]));
    const ordemDe = (personId) => {
        const i = targets.findIndex(t => t.personId === personId);
        return i >= 0 ? i : targets.length + pesosDeReserva.findIndex(p => p.personId === personId);
    };
    // Revisão 2: de cujus no exterior — a massa dos bens que seguem o domicílio do sucessor é
    // repartida pelos quinhões e cada parte vai para a UF de residência do PRÓPRIO sucessor (LC
    // 227/2026, arts. 158, III, e 159, II; CF, art. 155, § 1º). Quem não tem UF informada (ou mora no
    // exterior) fica com a parte em competência INDETERMINADA, estimada pela UF informada no falecido
    // ou pela do processo — nunca pela UF de outro herdeiro.
    const ufProvisoriaDoSucessor = deceased.successorDomicileState || settings.selectedState;
    const ufDoSucessor = (personId) => {
        const p = heirs.find(h => h.id === personId);
        if (p?.domiciledAbroad)
            return { uf: ufProvisoriaDoSucessor, indeterminado: true, motivo: 'NO_EXTERIOR' };
        if (p?.residenceState)
            return { uf: p.residenceState, indeterminado: false };
        return { uf: ufProvisoriaDoSucessor, indeterminado: true, motivo: 'SEM_UF' };
    };
    const temMassaPorSucessor = currentAssets.some(a => chaveDoBem(a) === PELO_SUCESSOR);
    const porSucessor = new Map();
    const massaPorSucessor = (leitura) => {
        if (!porSucessor.has(leitura))
            porSucessor.set(leitura, montarUf(PELO_SUCESSOR, leitura));
        return porSucessor.get(leitura);
    };
    const montarUfComSucessores = (state, leitura) => {
        const propria = montarUf(state, leitura);
        if (!temMassaPorSucessor)
            return propria;
        const quanto = new Map(propria.quanto);
        let semDono = propria.semDono;
        const daMassa = massaPorSucessor(leitura);
        daMassa.quanto.forEach((valor, personId) => {
            if (ufDoSucessor(personId).uf === state)
                quanto.set(personId, (quanto.get(personId) || 0) + valor);
        });
        if (state === ufProvisoriaDoSucessor)
            semDono += daMassa.semDono;
        const total = Array.from(quanto.values()).reduce((sum, v) => sum + v, 0);
        return { quanto, total, semDono };
    };
    const sucessoresNaUf = (state) => {
        if (!temMassaPorSucessor)
            return [];
        const ids = new Set();
        ['BRUTA', 'TRATAMENTO', 'INTEGRAL'].forEach(l => massaPorSucessor(l).quanto.forEach((v, id) => v > 0 && ids.add(id)));
        return Array.from(ids).filter(id => ufDoSucessor(id).uf === state).sort((a, b) => ordemDe(a) - ordemDe(b));
    };
    const itcdNaLeitura = (state, leitura) => {
        const { quanto, total, semDono } = montarUfComSucessores(state, leitura);
        const comuns = { state, perfil: (0, perfilUf_1.getPerfilItcdUf)(state), settings: itcdSettings, deathDate, taxType: 'CAUSA_MORTIS' };
        const itcd = total > 0
            ? (0, itcdPorBeneficiario_1.calcularItcdDaUf)({
                ...comuns,
                baseCentavos: (0, money_1.toCents)(total),
                pesos: Array.from(quanto.entries()).sort((a, b) => ordemDe(a[0]) - ordemDe(b[0])).map(([personId, valor]) => ({
                    personId,
                    personName: nomeDe.get(personId)?.personName ?? personId,
                    personType: nomeDe.get(personId)?.personType ?? 'OUTROS',
                    peso: valor,
                })),
            })
            : (0, itcdPorBeneficiario_1.calcularItcdDaUf)({ ...comuns, baseCentavos: (0, money_1.toCents)(semDono), pesos: [] });
        return { itcd, baseTotal: total + semDono, semDono: total > 0 ? semDono : 0 };
    };
    // UFs do ITCD: as dos bens + as dos sucessores que recebem da massa repartida por sucessor.
    const ufsComItcd = new Set(Array.from(taxableStates).filter(s => s !== PELO_SUCESSOR));
    if (temMassaPorSucessor) {
        ['BRUTA', 'TRATAMENTO', 'INTEGRAL'].forEach(l => {
            const m = massaPorSucessor(l);
            m.quanto.forEach((v, id) => v > 0 && ufsComItcd.add(ufDoSucessor(id).uf));
            if (m.semDono > 0)
                ufsComItcd.add(ufProvisoriaDoSucessor);
        });
    }
    const itcdBreakdown = Array.from(ufsComItcd)
        .map((state) => {
        const perfil = (0, perfilUf_1.getPerfilItcdUf)(state);
        const leitura = perfil.abateDividas === false ? 'BRUTA' : perfil.abateDividas === true ? 'INTEGRAL' : 'TRATAMENTO';
        const adotada = itcdNaLeitura(state, leitura);
        const bruta = itcdNaLeitura(state, 'BRUTA');
        const integral = itcdNaLeitura(state, 'INTEGRAL');
        // A UF só some do resultado se nenhuma leitura tiver base: com a dívida vinculada maior
        // que o bem, a leitura adotada pode dar zero e a outra não — e isso tem de aparecer.
        if (adotada.baseTotal <= 0 && bruta.baseTotal <= 0 && integral.baseTotal <= 0)
            return null;
        const itcd = adotada.itcd;
        const avisosDeBase = [];
        const haDividaQueAbateria = (0, money_1.toCents)(bruta.baseTotal) !== (0, money_1.toCents)(integral.baseTotal);
        if (perfil.abateDividas === false && haDividaQueAbateria) {
            const texto = (0, warnings_1.avisoDividasNaoAbatidas)(state, perfil.fonteAbateDividas);
            avisosDeBase.push(texto);
            avisos.push({
                codigo: 'DIVIDAS_NAO_ABATIDAS',
                categoria: 'BASE_CALCULO',
                gravidade: 'INFORMATIVO',
                mensagem: texto,
                fundamento: perfil.fonteAbateDividas,
                ufs: [state],
            });
        }
        if (perfil.abateDividas === 'controvertido' && haDividaQueAbateria) {
            const iguais = (0, money_1.toCents)(bruta.itcd.taxAmount) === (0, money_1.toCents)(itcd.taxAmount) && (0, money_1.toCents)(integral.itcd.taxAmount) === (0, money_1.toCents)(itcd.taxAmount);
            if (!iguais) {
                const texto = (0, warnings_1.avisoAbatimentoControvertido)(state, bruta.itcd.taxAmount, integral.itcd.taxAmount);
                avisosDeBase.push(texto);
                avisos.push({
                    codigo: 'ABATIMENTO_DIVIDAS_CONTROVERTIDO',
                    categoria: 'BASE_CALCULO',
                    gravidade: 'ATENCAO',
                    mensagem: texto,
                    fundamento: perfil.fonteAbateDividas,
                    ufs: [state],
                    valores: { itcdAdotado: itcd.taxAmount, itcdBaseBruta: bruta.itcd.taxAmount, itcdTodasAbatidas: integral.itcd.taxAmount },
                });
            }
        }
        const baseSemDono = itcd.semBeneficiarios ? itcd.taxBase : adotada.semDono;
        if (baseSemDono > 0) {
            avisos.push({
                codigo: 'ITCD_SEM_BENEFICIARIOS',
                categoria: 'BASE_CALCULO',
                gravidade: 'ATENCAO',
                mensagem: (0, warnings_1.avisoItcdSemBeneficiarios)(state, baseSemDono),
                fundamento: 'CTN, art. 35, parágrafo único',
                ufs: [state],
                valores: { base: baseSemDono },
            });
        }
        // RECONCILIADO (CALC-09): só o frontend levava a regra e o aviso de competência ao ITCD.
        const assetsInState = currentAssets.filter(asset => chaveDoBem(asset) === state);
        const stateCompetences = assetsInState.map(asset => competenceByAsset.get(asset.id));
        // Revisão 2: partes da massa repartida por sucessor que caem nesta UF.
        const bensPorSucessor = currentAssets.filter(a => chaveDoBem(a) === PELO_SUCESSOR);
        const sucessoresAqui = sucessoresNaUf(state);
        const sucessoresIndeterminados = sucessoresAqui.filter(id => ufDoSucessor(id).indeterminado);
        const regrasPorSucessor = sucessoresAqui.length === 0
            ? []
            : [
                ...(sucessoresAqui.length > sucessoresIndeterminados.length ? bensPorSucessor.map(a => competenceByAsset.get(a.id).competence) : []),
                ...(sucessoresIndeterminados.length > 0 ? [competencia_1.ITCD_COMPETENCE_RULES.SUCESSOR_DOMICILIO_NAO_INFORMADO] : []),
            ];
        const avisosDeSucessor = sucessoresIndeterminados.map(id => (0, warnings_1.avisoSucessorSemUf)(nomeDe.get(id)?.personName ?? id, ufDoSucessor(id).motivo));
        const competenceRules = Array.from(new Map([...stateCompetences.map(c => c.competence), ...regrasPorSucessor].map(c => [c.rule, c])).values());
        const competenceWarnings = Array.from(new Set([...stateCompetences.map(c => c.warning), ...avisosDeSucessor].filter((w) => !!w)));
        if (sucessoresIndeterminados.length > 0) {
            avisos.push({
                codigo: 'COMPETENCIA_INDETERMINADA',
                categoria: 'COMPETENCIA',
                gravidade: 'EXIGE_CONFIRMACAO',
                mensagem: avisosDeSucessor.join(' '),
                fundamento: 'CF, art. 155, § 1º; LC 227/2026, arts. 158, III, e 159, II e V',
                ufs: [state],
                pessoas: sucessoresIndeterminados,
                bens: bensPorSucessor.map(a => a.id),
            });
        }
        const warningMessage = [itcd.warningMessage, ...avisosDeBase, ...competenceWarnings].filter((w) => !!w).join(' ') || undefined;
        // CALC-03: bem cujo Estado competente não pôde ser determinado. O valor continua
        // calculado na UF do processo, mas a estimativa vira aviso estruturado e trava a
        // minuta até o advogado confirmar — nunca sai com cara de competência resolvida.
        const indeterminados = assetsInState.filter(asset => competenceByAsset.get(asset.id).indeterminada);
        if (indeterminados.length > 0) {
            avisos.push({
                codigo: 'COMPETENCIA_INDETERMINADA',
                categoria: 'COMPETENCIA',
                gravidade: 'EXIGE_CONFIRMACAO',
                mensagem: Array.from(new Set(indeterminados.map(a => competenceByAsset.get(a.id).warning))).join(' '),
                fundamento: 'CF, art. 155, § 1º; LC 227/2026, arts. 158 e 159',
                ufs: [state],
                bens: indeterminados.map(a => a.id),
                valores: { valorDosBens: (0, money_1.fromCents)(indeterminados.reduce((s, a) => s + (0, money_1.toCents)(getAssetNetValue(a)), 0)) },
            });
        }
        return {
            state,
            taxBase: itcd.taxBase,
            taxAmount: itcd.taxAmount,
            registryFee: registryFeesByState.get(state) || 0,
            assetCount: (assetCountByState.get(state) || 0) + (sucessoresAqui.length > 0 ? bensPorSucessor.length : 0),
            effectiveRate: itcd.effectiveRate,
            legalText: itcd.legalText,
            discountApplied: itcd.discountApplied,
            originalTaxAmount: itcd.originalTaxAmount,
            discountValue: itcd.discountValue,
            warningMessage,
            confiabilidade: itcd.confiabilidade,
            pendenciaHomologacao: itcd.pendenciaHomologacao,
            calculationMemory: itcd.calculationMemory,
            fiscalUnitUsed: itcd.fiscalUnitUsed,
            competenceRules,
            competenciaIndeterminada: indeterminados.length > 0 || sucessoresIndeterminados.length > 0,
            calculoIndeterminado: itcd.vigencia === 'ANTERIOR',
            vigenciaDesde: itcd.vigenciaDesde,
            baseDeCalculo: itcd.baseDeCalculo,
            fundamentoBaseDeCalculo: itcd.fundamentoBaseDeCalculo,
            situacaoTabela: perfil.situacaoTabela,
            abateDividas: perfil.abateDividas,
            fonteAbateDividas: perfil.fonteAbateDividas,
            beneficiarios: itcd.beneficiarios,
        };
    })
        .filter((item) => item !== null)
        .sort((a, b) => a.state.localeCompare(b.state));
    const totalTaxAmount = (0, money_1.fromCents)(itcdBreakdown.reduce((sum, item) => sum + (0, money_1.toCents)(item.taxAmount), 0));
    const itcdPorBeneficiario = [];
    itcdBreakdown.forEach(uf => uf.beneficiarios.forEach(b => {
        let pessoa = itcdPorBeneficiario.find(p => p.personId === b.personId);
        if (!pessoa) {
            pessoa = { personId: b.personId, personName: b.personName, personType: b.personType, base: 0, taxAmount: 0, porUf: [] };
            itcdPorBeneficiario.push(pessoa);
        }
        pessoa.porUf.push({ state: uf.state, base: b.base, taxAmount: b.taxAmount });
        pessoa.base = (0, money_1.fromCents)((0, money_1.toCents)(pessoa.base) + (0, money_1.toCents)(b.base));
        pessoa.taxAmount = (0, money_1.fromCents)((0, money_1.toCents)(pessoa.taxAmount) + (0, money_1.toCents)(b.taxAmount));
    }));
    // Na ordem dos alvos da partilha (cônjuge, depois herdeiros na ordem do cadastro).
    itcdPorBeneficiario.sort((a, b) => targets.findIndex(t => t.personId === a.personId) - targets.findIndex(t => t.personId === b.personId));
    // ===== ITCD sobre excesso de meação/quinhão (doação) =====
    // Quem recebe além do quinhão (excessValue) é donatário; quem recebe aquém (underValue) é
    // doador. O excesso de cada donatário se reparte entre os doadores na proporção do
    // underValue, e cada fatia é rateada pelos bens (item 5.4 do anexo): imóvel no Brasil →
    // situação; móvel → domicílio do doador (ou do donatário, doador no exterior — art. 159, IV).
    const donationBreakdown = [];
    const donors = targets.filter(t => t.underValue > 1);
    const donees = targets.filter(t => t.excessValue > 1);
    const totalUnderValue = donors.reduce((s, t) => s + t.underValue, 0);
    // Valor líquido CLAMPADO em zero: bem com passivo vinculado maior que o valor não infla o rateio.
    const getAssetNetValueForRateio = (asset) => Math.max(0, getAssetNetValue(asset));
    const partitionedPatrimony = currentAssets.reduce((s, a) => s + getAssetNetValueForRateio(a), 0);
    const findHeirPerson = (personId) => heirs.find(h => h.id === personId) || (personId === spouseId ? spousePerson : undefined);
    // CALC-03 (mesmo defeito, na doação): sem domicílio informado a UF do processo entra como
    // ESTIMATIVA e isso é dito no evento; antes o rótulo afirmava "domicílio do doador".
    const getDomicile = (personId) => {
        const p = findHeirPerson(personId);
        return {
            state: p?.residenceState || settings.selectedState,
            abroad: !!p?.domiciledAbroad,
            informado: !!p?.residenceState,
            nome: p?.name || personId,
        };
    };
    const avisoDomicilioDaDoacao = (quem, nome) => `Domicílio do ${quem} (${nome}) não informado: competência estimada pela UF do processo (${settings.selectedState}). ` +
        `Informe a UF de residência na qualificação para determinar a competência da doação (LC 227/2026, art. 159).`;
    if (totalUnderValue > 0 && partitionedPatrimony > 0) {
        for (const donee of donees) {
            const doneeDom = getDomicile(donee.personId);
            for (const donor of donors) {
                const transfer = donee.excessValue * (donor.underValue / totalUnderValue);
                if (transfer <= 1)
                    continue;
                const donorDom = getDomicile(donor.personId);
                const sliceByState = new Map();
                currentAssets.forEach(asset => {
                    const slice = transfer * (getAssetNetValueForRateio(asset) / partitionedPatrimony);
                    if (slice <= 0)
                        return;
                    const isDomesticImmovable = asset.type === 'IMOVEL' && asset.location !== 'EXTERIOR';
                    let state;
                    let legalText;
                    let warning;
                    let motivo;
                    if (isDomesticImmovable) {
                        state = asset.state || settings.selectedState;
                        legalText = 'Doação (excesso) — imóvel no Brasil: competência da situação do bem (art. 158, I, LC 227/2026).';
                    }
                    else if (!donorDom.abroad) {
                        state = donorDom.state;
                        legalText = 'Doação (excesso de meação/quinhão) — competência do domicílio do doador (art. 159, III / art. 158, II p/ imóvel no exterior, LC 227/2026).';
                        if (!donorDom.informado) {
                            warning = avisoDomicilioDaDoacao('doador', donorDom.nome);
                            motivo = 'DOMICILIO_DO_DOADOR_NAO_INFORMADO';
                        }
                    }
                    else if (!doneeDom.abroad) {
                        state = doneeDom.state;
                        legalText = 'Doação (excesso) — doador no exterior: competência do domicílio do donatário (art. 159, IV / art. 158, III, LC 227/2026).';
                        if (!doneeDom.informado) {
                            warning = avisoDomicilioDaDoacao('donatário', doneeDom.nome);
                            motivo = 'DOMICILIO_DO_DONATARIO_NAO_INFORMADO';
                        }
                    }
                    else {
                        state = settings.selectedState;
                        legalText = 'Doação (excesso) — doador e donatário no exterior: competência da UF de localização do bem no Brasil (art. 159, V, LC 227/2026).';
                        warning = 'Doador e donatário no exterior: competência estimada pela UF do processo. Confirme a localização do bem no Brasil e a lei estadual aplicável (Tema 825/STF); se o bem estiver no exterior, a hipótese está fora do campo de incidência.';
                        motivo = 'DOADOR_E_DONATARIO_NO_EXTERIOR';
                    }
                    const cur = sliceByState.get(state) || { value: 0, legalText, warning, motivo };
                    cur.value += slice;
                    if (warning)
                        cur.warning = warning;
                    if (motivo)
                        cur.motivo = motivo;
                    sliceByState.set(state, cur);
                });
                sliceByState.forEach((meta, state) => {
                    if (meta.value <= 1)
                        return;
                    // CALC-08: valor doado e ITCD da doação a centavo.
                    const valorDoado = (0, money_1.roundMoney)(meta.value);
                    const tax = (0, itcdPorBeneficiario_1.arredondarResultadoItcd)((0, itcdStrategies_1.calculateItcdForState)(state, valorDoado, itcdSettings, deathDate, 'DOACAO'));
                    donationBreakdown.push({
                        donorId: donor.personId,
                        donorName: donor.personName,
                        donorState: state,
                        receiverId: donee.personId,
                        receiverName: donee.personName,
                        value: valorDoado,
                        taxAmount: tax.taxAmount,
                        legalText: meta.legalText,
                        warningMessage: [tax.warningMessage, meta.warning].filter(Boolean).join(' ') || undefined,
                        // Nenhum dos dois motores carimbava a doação, embora os dois tipos o
                        // declarassem: a tela lia "sem carimbo" e tratava como não conferida.
                        confiabilidade: tax.confiabilidade,
                        situacaoTabela: tax.situacaoTabela,
                        // Revisão 4: marca própria no evento — o app cruzava o aviso por UF e pessoas.
                        competenciaEstimada: !!meta.motivo,
                        motivoCompetenciaEstimada: meta.motivo,
                        calculationMemory: tax.calculationMemory,
                    });
                });
            }
        }
    }
    const totalExcessTax = somaReais(donationBreakdown.map(e => e.taxAmount));
    donees.forEach(d => {
        d.excessTax = somaReais(donationBreakdown.filter(e => e.receiverId === d.personId).map(e => e.taxAmount));
    });
    const doacoesEstimadas = donationBreakdown.filter(e => e.competenciaEstimada);
    if (doacoesEstimadas.length > 0) {
        avisos.push({
            codigo: 'COMPETENCIA_DOACAO_ESTIMADA',
            categoria: 'COMPETENCIA',
            // Revisão: trava a minuta, como na causa mortis.
            gravidade: 'EXIGE_CONFIRMACAO',
            mensagem: 'ITCD sobre excesso de quinhão com competência estimada pela UF do processo: falta o domicílio de doador ou ' +
                'donatário, ou ambos estão no exterior. Complete a qualificação para determinar a competência da doação.',
            fundamento: 'LC 227/2026, arts. 158 e 159',
            ufs: Array.from(new Set(doacoesEstimadas.map(e => e.donorState))).sort(),
            pessoas: Array.from(new Set(doacoesEstimadas.flatMap(e => [e.donorId, e.receiverId]))),
        });
    }
    // CALC-06: uma ressalva por UF usada (causa mortis ou doação), na situação da tabela dela. A
    // divergência conhecida trava a minuta: o número sabidamente não é o da lei.
    const ufsNaoHomologadas = new Set([
        ...itcdBreakdown.filter(i => i.confiabilidade !== 'HOMOLOGADA').map(i => i.state),
        ...donationBreakdown.filter(e => e.confiabilidade !== 'HOMOLOGADA').map(e => e.donorState),
    ]);
    Array.from(ufsNaoHomologadas)
        .sort()
        .forEach(uf => {
        const perfil = (0, perfilUf_1.getPerfilItcdUf)(uf);
        avisos.push({
            codigo: CODIGO_DA_SITUACAO[perfil.situacaoTabela],
            categoria: 'TABELA_NAO_HOMOLOGADA',
            // Revisão: faixas estimadas também travam a minuta — o número não tem fonte legal.
            gravidade: perfil.situacaoTabela === 'DIVERGENCIA_CONHECIDA' || perfil.situacaoTabela === 'FAIXAS_ESTIMADAS' ? 'EXIGE_CONFIRMACAO' : 'ATENCAO',
            mensagem: (0, warnings_1.avisoTabelaPorSituacao)(uf, perfil),
            fundamento: perfil.fonteSituacao,
            ufs: [uf],
        });
    });
    // ===== Revisão: avisos e travas que faltavam =====
    const ufsDoItcd = itcdBreakdown.map(i => i.state);
    // (c) vigência registrada da tabela x data do fato gerador, causa mortis e doação.
    const vigenciaDaDoacao = (state) => (0, itcdStrategies_1.calculateItcdForState)(state, 0, itcdSettings, deathDate, 'DOACAO');
    const ufsForaDaVigencia = Array.from(new Set([
        ...itcdBreakdown.filter(i => i.calculoIndeterminado).map(i => i.state),
        ...donationBreakdown.map(e => e.donorState).filter(state => vigenciaDaDoacao(state).vigencia === 'ANTERIOR'),
    ])).sort();
    ufsForaDaVigencia.forEach(state => {
        const perfil = (0, perfilUf_1.getPerfilItcdUf)(state);
        avisos.push({
            codigo: 'TABELA_FORA_DA_VIGENCIA',
            categoria: 'TABELA_NAO_HOMOLOGADA',
            gravidade: 'EXIGE_CONFIRMACAO',
            mensagem: (0, warnings_1.avisoTabelaForaDaVigencia)(state, perfil.vigenciaDesde, deathDate, perfil.fonteVigencia),
            fundamento: perfil.fonteVigencia,
            ufs: [state],
        });
    });
    const ufsSemDataParaVigencia = Array.from(new Set([...ufsDoItcd, ...donationBreakdown.map(e => e.donorState)]))
        .filter(state => (0, perfilUf_1.situacaoDaVigencia)(state, deathDate) === 'SEM_DATA')
        .sort();
    ufsSemDataParaVigencia.forEach(state => {
        const perfil = (0, perfilUf_1.getPerfilItcdUf)(state);
        avisos.push({
            codigo: 'VIGENCIA_TABELA_NAO_CONFERIDA',
            categoria: 'TABELA_NAO_HOMOLOGADA',
            gravidade: 'ATENCAO',
            mensagem: (0, warnings_1.avisoVigenciaSemData)(state, perfil.vigenciaDesde, perfil.fonteVigencia),
            fundamento: perfil.fonteVigencia,
            ufs: [state],
        });
    });
    // Unidade fiscal que não cobre a data do fato gerador: pode trocar a faixa (RJ, RS, CE, MT).
    const ufsComIndiceForaDaVigencia = Array.from(new Set([
        ...itcdBreakdown.filter(i => i.fiscalUnitUsed?.outdated).map(i => i.state),
        ...donationBreakdown.map(e => e.donorState).filter(state => vigenciaDaDoacao(state).fiscalUnitUsed?.outdated),
    ])).sort();
    if (ufsComIndiceForaDaVigencia.length > 0) {
        avisos.push({
            codigo: 'INDICE_FISCAL_FORA_DA_VIGENCIA',
            categoria: 'INDICE_FISCAL',
            gravidade: 'EXIGE_CONFIRMACAO',
            mensagem: `A unidade fiscal usada em ${ufsComIndiceForaDaVigencia.join(', ')} não cobre a data do fato gerador ` +
                `(${deathDate ? deathDate.split('-').reverse().join('/') : 'data do óbito não informada'}): o cálculo usou o último valor conhecido. ` +
                'Como as faixas são expressas na unidade, o enquadramento pode mudar. Confirme o índice da data antes da minuta.',
            fundamento: 'services/fiscalUnitsApi.ts (série de vigências por UF)',
            ufs: ufsComIndiceForaDaVigencia,
        });
    }
    // Herança insolvente: o passivo alcança todo o monte (dívida do espólio, ou vinculada ao bem
    // maior que o próprio bem). CC, art. 1.792: o herdeiro não responde além das forças da herança.
    const ativoBruto = somaReais(currentAssets.map(a => Math.max(0, getAssetValue(a))));
    if (ativoBruto > 0 && monteLiquido <= 0 && normalizedLiabilities.some(l => (l.value || 0) > 0)) {
        avisos.push({
            codigo: 'HERANCA_INSOLVENTE',
            categoria: 'LEGITIMA',
            gravidade: 'EXIGE_CONFIRMACAO',
            mensagem: `O passivo alcança todo o monte (bens de ${(0, formatters_1.formatCurrency)(ativoBruto)}; monte líquido ${(0, formatters_1.formatCurrency)(monteLiquido)}): ` +
                'não há legítima nem parte disponível a calcular, e o herdeiro não responde por encargos superiores às forças da ' +
                'herança (CC, art. 1.792). Avalie a renúncia, o inventário negativo ou a habilitação dos credores antes da minuta.' +
                (usouPesosDeReserva
                    ? ' O ITCD das UFs que não abatem dívidas foi rateado pelos quinhões legais, calculados sobre o valor bruto dos bens.'
                    : ''),
            fundamento: 'CC, arts. 1.792 e 1.997',
            valores: { ativoBruto, monteLiquido, passivo: totalLiabilitiesValue },
        });
    }
    // Revisão 2: a competência por sucessor passou a ser APURADA (acima). Fica um aviso informativo
    // dizendo para que UF foi a parte de cada sucessor; a indeterminação de quem não tem UF já trava
    // a minuta pelo aviso COMPETENCIA_INDETERMINADA da UF.
    if (temMassaPorSucessor) {
        const sucessores = Array.from(new Set(['BRUTA', 'TRATAMENTO', 'INTEGRAL'].flatMap(l => Array.from(massaPorSucessor(l).quanto.entries()).filter(([, v]) => v > 0).map(([id]) => id)))).sort((a, b) => ordemDe(a) - ordemDe(b));
        const descricao = sucessores
            .map(id => {
            const destino = ufDoSucessor(id);
            return `${nomeDe.get(id)?.personName ?? id}: ${destino.indeterminado ? `indeterminada (estimada em ${destino.uf})` : destino.uf}`;
        })
            .join('; ');
        avisos.push({
            codigo: 'COMPETENCIA_POR_SUCESSOR',
            categoria: 'COMPETENCIA',
            gravidade: 'INFORMATIVO',
            mensagem: 'De cujus no exterior: o ITCD dos bens que seguem o domicílio do sucessor foi apurado por sucessor, na UF de ' +
                `residência de cada um (LC 227/2026, arts. 158, III, e 159, II; CF, art. 155, § 1º). ${descricao}.`,
            fundamento: 'CF, art. 155, § 1º; LC 227/2026, arts. 158, III, e 159, II',
            ufs: Array.from(new Set(sucessores.map(id => ufDoSucessor(id).uf))).sort(),
            pessoas: sucessores,
            bens: currentAssets.filter(a => chaveDoBem(a) === PELO_SUCESSOR).map(a => a.id),
        });
    }
    // Base por quinhão adotada só pela norma geral (CTN), onde o repositório não registra norma
    // estadual sobre o ponto. Só importa havendo mais de um beneficiário na UF.
    const ufsSoPeloCtn = itcdBreakdown.filter(i => i.beneficiarios.length > 1 && (0, perfilUf_1.baseSoPeloCtn)(i.state)).map(i => i.state);
    if (ufsSoPeloCtn.length > 0) {
        avisos.push({
            codigo: 'BASE_QUINHAO_SO_PELO_CTN',
            categoria: 'BASE_CALCULO',
            gravidade: 'INFORMATIVO',
            mensagem: `Em ${ufsSoPeloCtn.join(', ')} o ITCD foi apurado quinhão a quinhão pela norma geral do CTN (art. 35, parágrafo único), ` +
                'sem norma estadual registrada no PartilhaMais sobre a base de cálculo. Confira a lei da UF.',
            fundamento: 'CTN, art. 35, parágrafo único',
            ufs: ufsSoPeloCtn,
        });
    }
    // Revisão 4: atribuição de bem cuja dívida vinculada supera o valor. O cálculo segue o que foi
    // atribuído (a pessoa fica com saldo negativo e o excesso do outro vira doação), mas isso quase
    // sempre é atribuição a rever — e a doação gerada é tributada.
    const atribuicoesNegativas = atribuicoesDoResultado.filter(a => a.valorLiquido < 0);
    if (atribuicoesNegativas.length > 0) {
        const pessoas = Array.from(new Set(atribuicoesNegativas.map(a => a.personId))).sort((a, b) => ordemDe(a) - ordemDe(b));
        const bens = Array.from(new Set(atribuicoesNegativas.map(a => a.assetId)));
        const resumo = assetDebtSummary.filter(s => bens.includes(s.assetId));
        const doacaoGerada = somaReais(donationBreakdown.filter(e => pessoas.includes(e.donorId)).map(e => e.value));
        const nomes = pessoas.map(id => targets.find(t => t.personId === id)?.personName ?? id).join(', ');
        avisos.push({
            codigo: 'ATRIBUICAO_COM_LIQUIDO_NEGATIVO',
            categoria: 'OUTRO',
            gravidade: 'EXIGE_CONFIRMACAO',
            mensagem: `${nomes} recebe bem cuja dívida vinculada é maior que o valor do bem (líquido de ` +
                `${(0, formatters_1.formatCurrency)(somaReais(atribuicoesNegativas.map(a => a.valorLiquido)))}): fica com saldo negativo, e o que os ` +
                `outros recebem além do quinhão foi tratado como doação${doacaoGerada > 0 ? ` (${(0, formatters_1.formatCurrency)(doacaoGerada)}, com ITCD)` : ''}. ` +
                'Reveja a atribuição — por exemplo, atribuindo a dívida junto de outros bens ou compensando por torna.',
            fundamento: 'CC, arts. 1.997 e 2.017',
            pessoas,
            bens,
            valores: {
                valorBruto: somaReais(resumo.map(s => s.grossValue)),
                dividaVinculada: somaReais(resumo.map(s => s.deductedValue)),
                valorLiquido: somaReais(atribuicoesNegativas.map(a => a.valorLiquido)),
                doacaoGerada,
            },
        });
    }
    // Motivos que travam a minuta até confirmação explícita do advogado.
    const motivosDaMinuta = avisos.filter(a => a.gravidade === 'EXIGE_CONFIRMACAO');
    const resultado = {
        totalAssets: totalAssetsVal,
        totalLiabilities: totalLiabilitiesValue,
        netEstate: successionBase,
        totalMeacao,
        herancaTotal: herancaLiquidaFisicaTotal,
        successionBase,
        disposablePortion,
        compulsoryPortion,
        testamentaryTotal: (0, money_1.roundMoney)(testamentaryDisposed),
        isTestamentaryExcessive,
        monteLiquido,
        passivoDoEspolioNaHeranca,
        taxBase: monteMorFisicoPartilhavel,
        taxAmount: totalTaxAmount,
        totalExcessTax,
        pendingEstateLiabilitiesTotal,
        projectedNetEstate,
        discountsApplied: [],
        // Ordem de entrada (spouse primeiro), para a tela; os valores não dependem dela.
        targets: [...targets].sort((a, b) => (a.personId === spouseId && hasSpouse ? -1 : ordemDeEntrada.get(a.personId) ?? Number.MAX_SAFE_INTEGER) -
            (b.personId === spouseId && hasSpouse ? -1 : ordemDeEntrada.get(b.personId) ?? Number.MAX_SAFE_INTEGER)),
        notaryFee: somaReais([deedFee, totalRegistryFee]),
        deedFee,
        registryFee: totalRegistryFee,
        notaryFeeStatus: deedFees.status,
        itcdBreakdown,
        itcdPorBeneficiario,
        atribuicoes: atribuicoesDoResultado,
        donationBreakdown,
        estateSettlementItems: [],
        assetDebtSummary,
        liabilityReport: (0, valoracao_1.buildLiabilityReport)(normalizedLiabilities),
        itcdIndeterminado: itcdBreakdown.some(i => i.calculoIndeterminado) || ufsForaDaVigencia.length > 0,
        visao: { baseDeAvaliacao: valuationBasis, filtroDeBens, bensForaDaPartilha: bensForaDaPartilha.map(a => a.id).sort() },
        montes: {
            bensBrutos: somaReais(currentAssets.map(getAssetValue)),
            passivoVinculado: somaReais(assetDebtSummary.map(s => s.deductedValue)),
            passivoAssumidoPorHerdeiros: somaReais([totalDebtCommon, totalDebtPrivate]),
            herancaFisica: herancaLiquidaFisicaTotal,
            meacao: totalMeacao,
            montePartilhavel: monteMorFisicoPartilhavel,
            colacao: totalColacao,
            monteComColacao: successionBase,
            passivoDoEspolio: pendingEstateLiabilitiesTotal,
            passivoDoEspolioNaHeranca,
            monteLiquido,
        },
        testamento: {
            disponivel: disposablePortion,
            dispostoLiquido: (0, money_1.roundMoney)(testamentaryDisposed),
            atribuidoBruto: somaReais(targets.map(t => t.testamentaryValue)),
            fatorQuota: fatoresDeReducao.quota,
            fatorLegado: fatoresDeReducao.legado,
            disposicoes: disposicoesDoTestamento,
        },
        avisos,
        minuta: { exigeConfirmacao: motivosDaMinuta.length > 0, motivos: motivosDaMinuta },
        engineVersion: exports.PARTITION_ENGINE_VERSION,
    };
    return { resultado, pesosLivres };
}
