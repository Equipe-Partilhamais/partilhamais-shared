import { ItcdCalculationMemory, UF } from '../../types';
import { NotaryFeeMetadata, NotaryFeeRange, NotaryFeeResult } from '../notaryFeeEngine';
import {
    SuccessionExclusion,
    SuccessionHeirSubtype,
    SuccessionHeirType,
    SuccessionMaritalRegime,
} from '../successionCore';
import { ItcdFiscalUnitUsed, ItcdReliability, ItcdWarningCategory } from '../itcdStrategies/types';
import { AbatimentoDividasItcd, BaseDeCalculoItcd, SituacaoTabelaItcd } from '../itcdStrategies/perfilUf';
import { ItcdBeneficiarioUf } from './itcdPorBeneficiario';
import { FracaoRazao } from '../../utils/money';

export type { ItcdBeneficiarioUf };

// TIPOS DE ENTRADA DO MOTOR DE PARTILHA.
//
// São ESTRUTURAIS de propósito: o frontend passa o `InventoryState` da store (com dezenas de
// campos de tela) e o backend passa o `InventoryStateForCalculation` montado da linha do
// Prisma — com `null` onde a coluna está vazia. Os dois têm de caber aqui sem conversão, por
// isso: (1) as enumerações são uniões de string, às quais os `string enum` dos dois apps são
// atribuíveis; (2) todo campo opcional aceita `null`; (3) só se declara o que o motor lê.

export type PartitionAssetType = 'IMOVEL' | 'MOVEL' | 'FINANCEIRO' | 'OUTROS' | 'ADIANTAMENTO';
export type PartitionAssetOrigin = 'PARTICULAR' | 'COMUM';
export type LiabilityPartitionTreatment = 'ESPOLIO' | 'BEM_VINCULADO' | 'HERDEIRO_TORNA';
export type LiabilityDistributionCriterion = 'PROPORCIONAL' | 'IGUALITARIA' | 'CONCENTRADA' | 'MANUAL';
export type AssetValuationBasis = 'MARKET' | 'STATE';

export interface PartitionAssignmentInput {
    personId: string;
    percentage?: number | null;
    value?: number | null;
    /** 'TESTAMENT' marca o legado de bem específico. */
    lockReason?: string | null;
}

export interface PartitionAssetInput {
    id: string;
    description?: string | null;
    type: PartitionAssetType;
    origin: PartitionAssetOrigin;
    /** UF de situação (imóvel). */
    state?: UF | null;
    /** URBANO | RURAL | EXTERIOR. */
    location?: string | null;
    marketValue: number;
    /** Valor de avaliação fiscal no topo do bem (frontend). */
    stateAssessedValue?: number | null;
    ownershipPercentage?: number | null;
    /** Bem entra na partilha "oficial"? Booleano aqui prevalece sobre `otherDetails.includeInOfficial`. */
    includeInOfficial?: boolean | null;
    otherDetails?: {
        stateAssessedValue?: number | null;
        /** BRASIL | EXTERIOR. */
        locationType?: string | null;
        /** `false` tira o bem da partilha "oficial" (ver `visao.filtroDeBens`). */
        includeInOfficial?: boolean | null;
    } | null;
    /** Donatário do adiantamento de legítima (tipo ADIANTAMENTO). */
    beneficiaryId?: string | null;
    assignments?: PartitionAssignmentInput[] | null;
}

export interface PartitionLiabilityInput {
    id: string;
    description?: string | null;
    value: number;
    origin?: PartitionAssetOrigin | null;
    partitionTreatment?: LiabilityPartitionTreatment | null;
    distributionCriterion?: LiabilityDistributionCriterion | null;
    responsibleHeirId?: string | null;
    escrituraObservation?: string | null;
    paymentMode?: 'ESTATE' | 'HEIRS' | null;
    assetLinks?: Array<{ assetId: string; deductedValue: number }> | null;
}

export interface PartitionHeirInput {
    id: string;
    name: string;
    type: SuccessionHeirType;
    subtype?: SuccessionHeirSubtype | null;
    /** Marca do meeiro na tela (o front também usa o id `spouse_auto`). */
    isSpouse?: boolean | null;
    isPreDeceased?: boolean | null;
    parentId?: string | null;
    testamentaryMode?: 'PERCENTAGE_OF_ESTATE' | 'SPECIFIC_ASSETS' | null;
    testamentaryPercentage?: number | null;
    successionExclusion?: SuccessionExclusion | null;
    ascendantLine?: 'PATERNA' | 'MATERNA' | null;
    siblingBond?: 'BILATERAL' | 'UNILATERAL' | null;
    residenceState?: UF | null;
    domiciledAbroad?: boolean | null;
}

export interface PartitionDeceasedInput {
    name?: string | null;
    deathDate?: string | null;
    maritalRegime: SuccessionMaritalRegime;
    spouseName?: string | null;
    hasWill?: boolean | null;
    lastResidenceState?: UF | null;
    domiciledAbroad?: boolean | null;
    successorDomicileState?: UF | null;
    /**
     * Qualificação do cônjuge guardada no falecido (a tela grava aqui renúncia, UF de residência,
     * domicílio no exterior...). O motor monta o cônjuge com ela — ver `montarConjugeDaEntrada`.
     */
    spouseQualification?: Partial<PartitionHeirInput> | null;
}

export interface PartitionSettingsInput {
    applyInventoryDiscount?: boolean | null;
    /** UF do processo (inventário/arrolamento/escritura). */
    selectedState: UF;
    itcdMovableState?: UF | null;
    donationState?: UF | null;
    assetValuationBasis?: AssetValuationBasis | null;
}

/** Revisão de integração: que bens entram — todos, ou só os marcados para a partilha oficial. */
export type FiltroDeBens = 'TODOS' | 'PARTILHA_OFICIAL';

/**
 * Visão da partilha pedida pelo consumidor. Padrão: base de `settings.assetValuationBasis` (ou
 * 'MARKET') e todos os bens. O motor NÃO decide qual visão vale para a minuta; só garante que
 * tela, minuta e servidor possam pedir a mesma, e declara no resultado (`visao`) a usada.
 */
export interface VisaoDaPartilha {
    baseDeAvaliacao?: AssetValuationBasis | null;
    /** 'PARTILHA_OFICIAL': só bens com `isAssetIncludedInOfficialPartition` verdadeiro. */
    filtroDeBens?: FiltroDeBens | null;
}

export interface PartitionInput {
    /** Revisão de integração: visão da partilha (base de avaliação e filtro de bens). */
    visao?: VisaoDaPartilha | null;
    deceased: PartitionDeceasedInput | null | undefined;
    assets: PartitionAssetInput[] | null | undefined;
    liabilities?: PartitionLiabilityInput[] | null;
    heirs: PartitionHeirInput[] | null | undefined;
    settings?: PartitionSettingsInput | null;
    /**
     * Tabelas de emolumentos. O frontend as recebe da API; o backend passa as próprias
     * (`NOTARY_TABLES`/`TABLE_METADATA`). Ausentes → `notaryFeeStatus` = TABLES_UNAVAILABLE.
     */
    feeTables?: Record<string, NotaryFeeRange[]> | null;
    feeMetadata?: Record<string, NotaryFeeMetadata> | null;
}

// ---------------------------------------------------------------- COMPETÊNCIA

// Regra de competência (sujeição ativa) que atribuiu o bem ao Estado.
// Art. 155, § 1º, CF; arts. 158/159, LC 227/2026.
export type ItcdCompetenceRule =
    | 'IMOVEL_SITUS'
    | 'IMOVEL_EXT_DOMICILIO_TITULAR'
    | 'IMOVEL_EXT_DOMICILIO_SUCESSOR'
    | 'MOVEL_DOMICILIO_DE_CUJUS'
    | 'MOVEL_EXT_DOMICILIO_SUCESSOR'
    | 'MOVEL_EXT_DOMICILIO_DONATARIO'
    | 'MOVEL_EXT_BEM_NO_BRASIL'
    | 'MOVEL_INVENTARIO_PROCESSO'
    // CALC-03: o elemento de conexão que define a competência não foi informado. A UF usada é
    // a do processo, SÓ como estimativa, e o rótulo diz isso — nunca o da regra que não se aplicou.
    | 'MOVEL_DOMICILIO_NAO_INFORMADO'
    | 'IMOVEL_UF_NAO_INFORMADA'
    | 'IMOVEL_EXT_DOMICILIO_NAO_INFORMADO'
    | 'SUCESSOR_DOMICILIO_NAO_INFORMADO';

export interface ItcdCompetenceInfo {
    rule: ItcdCompetenceRule;
    label: string;
    legalRef: string;
    /** CALC-03: competência indeterminada; o Estado usado é só estimativa. */
    indeterminada?: boolean;
}

// ---------------------------------------------------------------- RESULTADO

export interface AssetDebtDeductionSummary {
    assetId: string;
    grossValue: number;
    deductedValue: number;
    netValue: number;
    liabilities: Array<{ liabilityId: string; description: string; deductedValue: number; criterion?: string }>;
}

export interface LiabilityReportEntry {
    liabilityId: string;
    description: string;
    value: number;
    treatment: string;
    criterion?: string;
    responsibleHeirId?: string;
    escrituraObservation?: string;
    assetLinks: Array<{ assetId: string; deductedValue: number }>;
}

export interface EstateSettlementItem {
    id: string;
    liabilityId: string;
    description: string;
    value: number;
    assetIds: string[];
}

export interface PartitionTarget {
    personId: string;
    personName: string;
    personType: SuccessionHeirType;
    meacaoValue: number;
    theoreticalValue: number;
    advancementValue: number;
    inheritanceValue: number;
    legitimaValue: number;
    testamentaryValue: number;
    totalTargetValue: number;
    percentageOfEstate: number;
    grossTargetValue: number;
    grossAllocatedValue: number;
    assumedDebtValue: number;
    allocatedValue: number;
    excessValue: number;
    underValue: number;
    excessTax: number;
    /**
     * CALC-08: fração do monte (`theoreticalValue / successionBase`) como razão — "1/7" em vez de
     * "14,2857%". `null` quando o quinhão depende de valor e não tem razão de denominador
     * pequeno (concorrência do cônjuge só nos particulares, legado em reais): exiba o percentual.
     */
    fracaoDoMonte: FracaoRazao | null;
    /**
     * Revisão (b): parte do passivo do espólio (ESPOLIO) que este alvo suporta, na partilha exibida
     * antes da quitação. Sucessores universais (herdeiros legítimos e de quota) na proporção do que
     * recebem (CC, art. 1.997); o meeiro, a metade da dívida comum; o legatário de bem certo, nada
     * (salvo herança insuficiente). A soma entre os alvos é o passivo do espólio inteiro.
     */
    passivoDoEspolio: number;
    /** `totalTargetValue − passivoDoEspolio`, com piso em zero (CC, art. 1.792). */
    liquidoProjetado: number;
}

export interface PartitionItcdStateBreakdown {
    state: UF;
    taxBase: number;
    taxAmount: number;
    registryFee: number;
    assetCount: number;
    effectiveRate: number;
    legalText: string;
    discountApplied?: string;
    originalTaxAmount?: number;
    discountValue?: number;
    warningMessage?: string;
    confiabilidade?: ItcdReliability;
    pendenciaHomologacao?: string;
    calculationMemory?: ItcdCalculationMemory[];
    fiscalUnitUsed?: ItcdFiscalUnitUsed;
    competenceRules: ItcdCompetenceInfo[];
    /** CALC-03: há bem nesta UF cuja competência não pôde ser determinada (UF só estimada). */
    competenciaIndeterminada: boolean;
    /**
     * Revisão (c): o fato gerador é anterior ao início de vigência registrado da tabela desta UF;
     * a tabela da data não está no repositório. `taxAmount` é só referência (tabela atual) e NÃO
     * vale para o caso: exiba "indeterminado".
     */
    calculoIndeterminado: boolean;
    /** Início de vigência registrado da tabela codificada, quando há registro. */
    vigenciaDesde?: string;
    /** CALC-01: sobre que base a alíquota incidiu, e por quê. */
    baseDeCalculo: BaseDeCalculoItcd;
    fundamentoBaseDeCalculo: string;
    /** CALC-06: situação da tabela codificada desta UF (ver `PERFIL_ITCD_UF`). */
    situacaoTabela: SituacaoTabelaItcd;
    /** CALC-05: se as dívidas abatem a base nesta UF, e a fonte. */
    abateDividas: AbatimentoDividasItcd;
    fonteAbateDividas: string;
    /** CALC-01: uma guia por herdeiro/legatário. `taxAmount` da UF é a soma delas. */
    beneficiarios: ItcdBeneficiarioUf[];
}

/** Revisão de integração (5): uma disposição do testamento, com a redução do art. 1.967, § 1º. */
export interface DisposicaoTestamentaria {
    personId: string;
    tipo: 'QUOTA' | 'LEGADO';
    /** Quota: o percentual do testamento. Legado: `null` (ver `itens`). */
    percentual: number | null;
    /** Valor que conta para a inoficiosidade (quota: % da herança líquida; legado: valor válido, art. 1.914). */
    dispostoLiquido: number;
    /** Valor na partilha antes da quitação (quota: % do monte bruto; legado: igual ao líquido). */
    dispostoBruto: number;
    /** Fator do art. 1.967, § 1º (quotas primeiro, depois legados). 1 = sem redução. */
    fatorDeReducao: number;
    /** Quota: o percentual que o app deve gravar depois da redução (4 casas). */
    percentualAposReducao: number | null;
    /** Valor que fica com o beneficiário depois da redução (bruto). */
    valorAposReducao: number;
    itens: Array<{
        assetId: string;
        /** Percentual da atribuição travada pelo testamento (`null` se só por valor). */
        percentualOriginal: number | null;
        /** Valor legado como atribuído (líquido do financiamento vinculado, bem inteiro). */
        valorLegado: number;
        /** Depois do art. 1.914 (só a parte do testador). */
        valorValido: number;
        /** Depois da redução por inoficiosidade. */
        valorAposReducao: number;
        /** O percentual que o app deve gravar na atribuição do legado (4 casas). */
        percentualAposReducao: number | null;
    }>;
}

/** Revisão 4: por que a competência de um evento de doação é estimada. */
export type MotivoCompetenciaEstimada = 'DOMICILIO_DO_DOADOR_NAO_INFORMADO' | 'DOMICILIO_DO_DONATARIO_NAO_INFORMADO' | 'DOADOR_E_DONATARIO_NO_EXTERIOR';

/**
 * Revisão 4: valor de cada atribuição de bem, como o motor usa. Por bem, as partes com percentual
 * somam (pelo maior resto) o valor do bem × a soma dos percentuais; por pessoa, os `valorLiquido`
 * somam o `grossAllocatedValue` do alvo.
 */
export interface PartitionAssignmentValue {
    assetId: string;
    personId: string;
    /** Percentual informado (0–100); `null` quando a atribuição é só por valor. */
    percentage: number | null;
    /** O percentual como razão ("1/3", "3333/10000"); `null` sem percentual. */
    fracao: FracaoRazao | null;
    /** Parte do valor do bem ANTES da dívida vinculada (BEM_VINCULADO), com a titularidade aplicada. */
    valorBruto: number;
    /** Parte do valor do bem DEPOIS da dívida vinculada — é o que entra em `grossAllocatedValue`. */
    valorLiquido: number;
    lockReason?: string;
}

/** CALC-01: ITCD causa mortis de cada beneficiário, somado entre as UFs. */
export interface ItcdPorBeneficiario {
    personId: string;
    personName: string;
    personType: SuccessionHeirType;
    base: number;
    taxAmount: number;
    porUf: Array<{ state: UF; base: number; taxAmount: number }>;
}

// ---------------------------------------------------------------- AVISOS ESTRUTURADOS

/**
 * Categoria do aviso. As do ITCD são as mesmas de `classifyItcdWarning` (a tela e o DOCX já
 * sabem rotulá-las); as demais são da partilha.
 */
export type CategoriaAvisoCalculo = ItcdWarningCategory | 'LEGITIMA' | 'REGIME_DE_BENS' | 'EMOLUMENTOS';

/**
 * EXIGE_CONFIRMACAO: a minuta não pode sair sem o advogado confirmar, explicitamente, que leu.
 * ATENCAO: o número pode estar errado por dado faltante ou regra em aberto.
 * INFORMATIVO: regra aplicada que muda o resultado em relação ao que se costuma esperar.
 */
export type GravidadeAviso = 'EXIGE_CONFIRMACAO' | 'ATENCAO' | 'INFORMATIVO';

export type CodigoAvisoCalculo =
    /** CALC-01: base na UF e nenhum herdeiro/legatário com quinhão — ITCD da UF em 0. */
    | 'ITCD_SEM_BENEFICIARIOS'
    /** CALC-02: bem particular na comunhão universal (só nas exclusões do art. 1.668). */
    | 'COMUNHAO_UNIVERSAL_COM_BEM_PARTICULAR'
    /** CALC-03: falta o elemento de conexão (domicílio, UF do imóvel); UF do processo só estimada. */
    | 'COMPETENCIA_INDETERMINADA'
    /** CALC-03: doação por excesso de quinhão com competência estimada. */
    | 'COMPETENCIA_DOACAO_ESTIMADA'
    /** CALC-04: legítima/disponível calculadas sobre o monte líquido do passivo do espólio. */
    | 'LEGITIMA_SOBRE_MONTE_LIQUIDO'
    /** CALC-04: testamento excede a disponível líquida; já reduzido, mas a minuta precisa dizer. */
    | 'DISPOSICAO_INOFICIOSA'
    /** CALC-05: a lei da UF manda não abater dívidas (SP); ressalva das decisões em contrário. */
    | 'DIVIDAS_NAO_ABATIDAS'
    /** CALC-05: UF sem regra registrada; o ITCD pelas duas leituras vai em `valores`. */
    | 'ABATIMENTO_DIVIDAS_CONTROVERTIDO'
    /** CALC-06: tabela que sabidamente diverge da lei — trava a minuta. */
    | 'TABELA_DIVERGENCIA_CONHECIDA'
    /** CALC-06: tabela pesquisada em fonte primária, sem conferência assinada. */
    | 'TABELA_PESQUISADA_NAO_CONFERIDA'
    /** CALC-06: faixas sem fonte legal. */
    | 'TABELA_FAIXAS_ESTIMADAS'
    /** CALC-06: alíquota de referência, sem pesquisa registrada. */
    | 'TABELA_REFERENCIA'
    /** Sem tabela de emolumentos: os R$ 0,00 de escritura e registro são falta de dado. */
    | 'EMOLUMENTOS_NAO_CALCULADOS'
    /** Revisão: fato gerador anterior ao início de vigência registrado da tabela — ITCD indeterminado. */
    | 'TABELA_FORA_DA_VIGENCIA'
    /** Revisão: há início de vigência registrado e a data do fato gerador não foi informada. */
    | 'VIGENCIA_TABELA_NAO_CONFERIDA'
    /** Revisão: unidade fiscal usada não cobre a data do fato gerador (pode mudar a faixa). */
    | 'INDICE_FISCAL_FORA_DA_VIGENCIA'
    /** Revisão: passivo ≥ monte; o herdeiro não responde além das forças da herança. */
    | 'HERANCA_INSOLVENTE'
    /** Revisão 2: de cujus no exterior — ITCD apurado por sucessor, na UF de cada um (informativo). */
    | 'COMPETENCIA_POR_SUCESSOR'
    /** Revisão 2 — CC, art. 1.914: legado de bem comum vale só sobre a parte do testador. */
    | 'LEGADO_LIMITADO_A_PARTE_DO_TESTADOR'
    /** Revisão 3: cônjuge cadastrado com regime SOLTEIRO ou sem regime (ou só o nome, ignorado). */
    | 'CONJUGE_SEM_REGIME_DE_BENS'
    /** Revisão 3: pessoa com isSpouse e tipo diferente de CONJUGE, tratada como cônjuge. */
    | 'CONJUGE_MARCADO_SO_POR_ISSPOUSE'
    /** Revisão 3: mais de um cadastro de cônjuge/meeiro; o motor usa o primeiro. */
    | 'MAIS_DE_UM_CONJUGE'
    /** Revisão 3: regime de casamento informado sem cônjuge cadastrado (sem meação). */
    | 'REGIME_SEM_CONJUGE_CADASTRADO'
    /** Revisão: base por quinhão adotada só pelo CTN, sem norma estadual registrada. */
    | 'BASE_QUINHAO_SO_PELO_CTN'
    /** Revisão 4: atribuição de bem com dívida vinculada maior que o valor (saldo negativo; excesso do outro vira doação). */
    | 'ATRIBUICAO_COM_LIQUIDO_NEGATIVO';

export interface AvisoCalculo {
    /** Código estável: é por ele que a tela e o DOCX decidem o que mostrar. */
    codigo: CodigoAvisoCalculo;
    categoria: CategoriaAvisoCalculo;
    gravidade: GravidadeAviso;
    /** Texto pronto para exibir. */
    mensagem: string;
    fundamento?: string;
    ufs?: UF[];
    /** personId dos envolvidos. */
    pessoas?: string[];
    /** id dos bens envolvidos. */
    bens?: string[];
    /** Números de apoio (ex.: o ITCD por outra leitura da lei), em reais. */
    valores?: Record<string, number>;
}

export interface PartitionDonationEvent {
    donorId: string;
    donorName: string;
    donorState: UF;
    receiverId: string;
    receiverName: string;
    value: number;
    taxAmount: number;
    legalText: string;
    warningMessage?: string;
    confiabilidade?: ItcdReliability;
    /** CALC-06: situação da tabela de doação usada. */
    situacaoTabela?: SituacaoTabelaItcd;
    /**
     * Revisão 4: a UF deste evento é ESTIMADA (falta domicílio de doador/donatário, ou os dois estão
     * no exterior). Basta que uma parte do evento esteja nessa situação.
     */
    competenciaEstimada: boolean;
    motivoCompetenciaEstimada?: MotivoCompetenciaEstimada;
    calculationMemory?: ItcdCalculationMemory[];
}

export interface PartitionResult {
    totalAssets: number;
    totalLiabilities: number;
    netEstate: number;
    totalMeacao: number;
    herancaTotal: number;
    successionBase: number;
    /** CALC-04: monte líquido / 2 (sem colação). */
    disposablePortion: number;
    /** CALC-04: monte líquido / 2 + colação. */
    compulsoryPortion: number;
    /** Total DISPOSTO no testamento, antes da redução do art. 1.967. */
    testamentaryTotal: number;
    /** CALC-04: confrontado com a disponível líquida. */
    isTestamentaryExcessive: boolean;
    /** CALC-04: monte partilhável menos a parte do passivo do espólio que cabe à herança. */
    monteLiquido: number;
    /** CALC-04: parte do passivo ESPOLIO que onera a herança (a meação suporta metade do comum). */
    passivoDoEspolioNaHeranca: number;
    /** Monte partilhável (herança física menos meação). Nome mantido por compatibilidade. */
    taxBase: number;
    taxAmount: number;
    totalExcessTax: number;
    pendingEstateLiabilitiesTotal: number;
    projectedNetEstate: number;
    discountsApplied: string[];
    targets: PartitionTarget[];
    notaryFee: number;
    deedFee: number;
    registryFee: number;
    /** CALCULATED é o único status em que os emolumentos são valores; nos demais valem 0 por falta de tabela. */
    notaryFeeStatus: NotaryFeeResult['status'];
    itcdBreakdown: PartitionItcdStateBreakdown[];
    /** CALC-01: o mesmo ITCD causa mortis, visto por beneficiário. */
    itcdPorBeneficiario: ItcdPorBeneficiario[];
    /** Revisão 4: cada atribuição de bem (bruto, líquido e fração), como o motor usa. */
    atribuicoes: PartitionAssignmentValue[];
    /** Revisão de integração (2): a visão usada (base de avaliação, filtro e bens deixados de fora). */
    visao: { baseDeAvaliacao: AssetValuationBasis; filtroDeBens: FiltroDeBens; bensForaDaPartilha: string[] };
    /**
     * Revisão de integração (4): os montes, com definição explícita. Bens já com a base de avaliação
     * e a titularidade aplicadas; adiantamentos fora de `bensBrutos` e dentro de `colacao`.
     */
    montes: {
        /** Soma dos bens, antes de qualquer dívida (inclui a parte do cônjuge meeiro). */
        bensBrutos: number;
        /** Dívidas BEM_VINCULADO abatidas dos bens. */
        passivoVinculado: number;
        /** Dívidas HERDEIRO_TORNA abatidas da massa (com origem informada). */
        passivoAssumidoPorHerdeiros: number;
        /**
         * Herança física (= `herancaTotal`): por massa (comum e particular), bens − passivo vinculado −
         * passivo assumido, com piso em zero em cada massa. Sem massa negativa, é exatamente
         * bensBrutos − passivoVinculado − passivoAssumidoPorHerdeiros.
         */
        herancaFisica: number;
        /** Meação do cônjuge (= `totalMeacao`). */
        meacao: number;
        /** herancaFisica − meacao (= `taxBase`). */
        montePartilhavel: number;
        /** Adiantamentos de legítima trazidos à colação. */
        colacao: number;
        /** montePartilhavel + colacao (= `successionBase` = `netEstate`). */
        monteComColacao: number;
        /** Passivo ESPOLIO inteiro (= `pendingEstateLiabilitiesTotal`). */
        passivoDoEspolio: number;
        /** Parte do passivo ESPOLIO que onera a herança (a meação suporta metade do comum). */
        passivoDoEspolioNaHeranca: number;
        /** montePartilhavel − passivoDoEspolioNaHeranca: base da legítima e da disponível (CC, art. 1.847). */
        monteLiquido: number;
    };
    /** Revisão de integração (4 e 5): o testamento como o motor o aplicou. */
    testamento: {
        /** = `disposablePortion`. */
        disponivel: number;
        /** Total disposto em valor líquido, já com art. 1.914 e dívida (= `testamentaryTotal`). */
        dispostoLiquido: number;
        /** Soma do que ficou com os beneficiários depois da redução (bruto; = Σ targets[].testamentaryValue). */
        atribuidoBruto: number;
        /** Fatores do art. 1.967, § 1º (`inofficiousReductionFactors`). */
        fatorQuota: number;
        fatorLegado: number;
        disposicoes: DisposicaoTestamentaria[];
    };
    donationBreakdown: PartitionDonationEvent[];
    estateSettlementItems: EstateSettlementItem[];
    assetDebtSummary: AssetDebtDeductionSummary[];
    liabilityReport: LiabilityReportEntry[];
    /** Revisão (c): alguma UF com cálculo indeterminado (fora da vigência registrada). */
    itcdIndeterminado: boolean;
    /** Toda incerteza do cálculo, estruturada. A tela e o DOCX exibem todos. */
    avisos: AvisoCalculo[];
    /**
     * A minuta (petição/escritura) só pode ser gerada depois de o advogado confirmar,
     * explicitamente, os `motivos` — os avisos de gravidade EXIGE_CONFIRMACAO.
     */
    minuta: { exigeConfirmacao: boolean; motivos: AvisoCalculo[] };
    /** Versão do motor que produziu o resultado (gravar no snapshot). */
    engineVersion: string;
}
