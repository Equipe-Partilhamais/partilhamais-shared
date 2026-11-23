// Cenários de caracterização: rodam nos dois motores legados e no unificado.
//
// Cada cenário pode declarar MUDANÇAS INTENCIONAIS (regex do caminho + motivo). O teste exige
// as duas direções: toda diferença tem de estar declarada, e toda declaração tem de
// corresponder a uma diferença real — senão a lista vira documentação que ninguém confere.
import { NOTARY_TABLES, TABLE_METADATA } from './legado/backend.notaryFees';

export type Contra = 'FRONT' | 'BACK' | 'AMBOS';

export interface MudancaDeclarada {
    caminho: RegExp;
    motivo: string;
    contra?: Contra;
    /**
     * Só em `divergenciaLegada`: a divergência existe entre os dois legados, mas o unificado,
     * alimentado com as tabelas do backend, reproduz o backend — não há o que declarar contra ele.
     */
    soEntreLegados?: boolean;
}

export interface Cenario {
    id: string;
    descricao: string;
    entrada: any;
    /** Diferenças intencionais entre o motor unificado e o legado. */
    mudancas?: MudancaDeclarada[];
    /** Diferenças entre os DOIS legados (front × back), com a decisão tomada. */
    divergenciaLegada?: MudancaDeclarada[];
}

export const filho = (id: string, extra: Record<string, unknown> = {}) => ({ id, name: id, type: 'DESCENDENTE', subtype: 'FILHO', ...extra });

export const bem = (id: string, valor: number, extra: Record<string, unknown> = {}) => ({
    id,
    description: id,
    type: 'IMOVEL',
    origin: 'PARTICULAR',
    state: 'SP',
    location: 'URBANO',
    marketValue: valor,
    assignments: [],
    ...extra,
});

export const conta = (id: string, valor: number, extra: Record<string, unknown> = {}) =>
    bem(id, valor, { type: 'FINANCEIRO', state: undefined, location: undefined, ...extra });

export const caso = (over: {
    deceased?: Record<string, unknown>;
    heirs?: any[];
    assets?: any[];
    liabilities?: any[];
    settings?: Record<string, unknown>;
    semTabelas?: boolean;
}): any => ({
    deceased: {
        name: 'Falecido',
        deathDate: '2026-01-01',
        maritalRegime: 'SOLTEIRO',
        spouseName: '',
        hasWill: false,
        lastResidenceState: 'SP',
        ...over.deceased,
    },
    heirs: over.heirs ?? [],
    assets: over.assets ?? [],
    liabilities: over.liabilities ?? [],
    settings: {
        applyInventoryDiscount: false,
        selectedState: 'SP',
        donationState: 'SP',
        assetValuationBasis: 'MARKET',
        ...over.settings,
    },
    feeTables: over.semTabelas ? undefined : NOTARY_TABLES,
    feeMetadata: over.semTabelas ? undefined : TABLE_METADATA,
});

/** Escapa uma UF/ID para uso literal dentro de uma regex de caminho. */
const literal = (texto: string) => texto.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** ITCD da UF mudou por passar a ser apurado quinhão a quinhão (CALC-01). */
const CALC01 = (uf: string, motivo: string): MudancaDeclarada => ({
    caminho: new RegExp(`^(${literal(`itcd[${uf}].`)}(taxAmount|originalTaxAmount|effectiveRate)|total\\.taxAmount)$`),
    motivo: `CALC-01 (ITCD por quinhão): ${motivo}`,
});

const tresFilhos = [filho('f1'), filho('f2'), filho('f3')];
const doisFilhos = [filho('f1'), filho('f2')];
const conjuge = { id: 'conj', name: 'Cônjuge', type: 'CONJUGE' };

export const CENARIOS: Cenario[] = [
    // ------------------------------------------------------------ CALC-01 (base por quinhão)
    {
        id: 'quinhao-SP-1M-3-filhos',
        descricao: 'SP, imóvel de R$ 1.000.000, solteiro, 3 filhos (controle: alíquota fixa)',
        entrada: caso({ heirs: tresFilhos, assets: [bem('imovel', 1_000_000)] }),
    },
    {
        id: 'quinhao-RS-150k-3-filhos',
        descricao: 'RS, imóvel de R$ 150.000, 3 filhos — quinhão abaixo de 2.000 UPF-RS',
        entrada: caso({ heirs: tresFilhos, assets: [bem('imovel', 150_000, { state: 'RS' })] }),
        mudancas: [CALC01('RS', 'cada quinhão de R$ 50.000 fica abaixo de 2.000 UPF-RS — R$ 4.500 viram 0')],
    },
    {
        id: 'quinhao-RS-1M-3-filhos',
        descricao: 'RS, imóvel de R$ 1.000.000, 3 filhos',
        entrada: caso({ heirs: tresFilhos, assets: [bem('imovel', 1_000_000, { state: 'RS' })] }),
        mudancas: [CALC01('RS', '4% sobre cada quinhão em vez de 5% sobre o monte — R$ 50.000 viram 3 guias de R$ 13.333,33')],
    },
    {
        id: 'quinhao-BA-300k-3-filhos',
        descricao: 'BA, imóvel de R$ 300.000, 3 filhos — isenção por quinhão',
        entrada: caso({ heirs: tresFilhos, assets: [bem('imovel', 300_000, { state: 'BA' })] }),
        mudancas: [CALC01('BA', 'quinhão de R$ 100.000 isento (art. 4º, V) — R$ 18.000 viram 0')],
    },
    {
        id: 'quinhao-AL-2.4M-3-filhos',
        descricao: 'AL, imóvel de R$ 2.400.000, 3 filhos',
        entrada: caso({ heirs: tresFilhos, assets: [bem('imovel', 2_400_000, { state: 'AL' })] }),
        mudancas: [CALC01('AL', 'quinhão de R$ 800.000 enquadrado em 4% — R$ 144.000 viram R$ 96.000')],
    },
    {
        id: 'quinhao-RJ-3M-2-filhos',
        descricao: 'RJ (enquadramento em UFIR-RJ), imóvel de R$ 3.000.000, 2 filhos',
        entrada: caso({ heirs: doisFilhos, assets: [bem('imovel', 3_000_000, { state: 'RJ' })] }),
        mudancas: [CALC01('RJ', 'quinhão de R$ 1,5 mi enquadrado em 7% em vez de 8% no monte — R$ 240.000 viram R$ 210.000')],
    },
    {
        id: 'quinhao-SE-1M-2-filhos',
        descricao: 'SE (divergência conhecida), imóvel de R$ 1.000.000, 2 filhos',
        entrada: caso({ heirs: doisFilhos, assets: [bem('imovel', 1_000_000, { state: 'SE' })] }),
    },
    {
        id: 'quinhao-MG-desconto-2-filhos',
        descricao: 'MG com desconto de inventário pedido, 2 filhos',
        entrada: caso({
            deceased: { lastResidenceState: 'MG' },
            heirs: doisFilhos,
            assets: [bem('imovel', 800_000, { state: 'MG' })],
            settings: { selectedState: 'MG', applyInventoryDiscount: true },
        }),
    },
    {
        id: 'sem-herdeiros',
        descricao: 'bens cadastrados e nenhum herdeiro ainda',
        entrada: caso({ heirs: [], assets: [bem('imovel', 500_000)] }),
        mudancas: [CALC01('SP', 'sem herdeiro não há quinhão: imposto 0 com aviso ITCD_SEM_BENEFICIARIOS, em vez do imposto do monte sem ressalva')],
    },
    {
        id: 'multi-uf-imovel-RS-conta-MG',
        descricao: 'imóvel no RS e conta com domicílio em MG, processo em SP, 2 filhos',
        entrada: caso({
            deceased: { lastResidenceState: 'MG' },
            heirs: doisFilhos,
            assets: [bem('imovel', 600_000, { state: 'RS' }), conta('conta', 400_000)],
        }),
    },

    // ------------------------------------------------------------ CALC-02 (comunhão universal)
    {
        id: 'universal-comum-e-particular-SP',
        descricao: 'comunhão universal: comum 800 mil + particular 200 mil, cônjuge e 2 filhos, SP',
        entrada: caso({
            deceased: { maritalRegime: 'COMUNHAO_UNIVERSAL', spouseName: 'Cônjuge' },
            heirs: [conjuge, ...doisFilhos],
            assets: [bem('comum', 800_000, { origin: 'COMUM' }), bem('particular', 200_000)],
        }),
        mudancas: [
            {
                caminho: /^(total\.(totalMeacao|successionBase|netEstate|disposablePortion|compulsoryPortion|taxBase|taxAmount|registryFee|notaryFee)|alvo\[(conj|f1|f2)\]\.|itcd\[SP\]\.(taxBase|taxAmount|originalTaxAmount|registryFee))/,
                motivo: 'CALC-02: meação só sobre o comum — 500 mil viram 400 mil; cada filho 250 → 300 mil; base do ITCD 500 → 600 mil e ITCD 20.000 → 24.000; o registro do imóvel particular passa a incidir sobre o valor inteiro transmitido.',
            },
        ],
    },
    {
        id: 'universal-so-comum-MG',
        descricao: 'comunhão universal só com bens comuns, cônjuge e 3 filhos, MG',
        entrada: caso({
            deceased: { maritalRegime: 'COMUNHAO_UNIVERSAL', spouseName: 'Cônjuge', lastResidenceState: 'MG' },
            heirs: [conjuge, ...tresFilhos],
            assets: [bem('comum', 1_200_000, { origin: 'COMUM', state: 'MG' })],
            settings: { selectedState: 'MG' },
        }),
    },

    // ------------------------------------------------------------ regimes e classes
    {
        id: 'parcial-conjuge-concorre-particulares',
        descricao: 'comunhão parcial: comum 600 mil + particular 300 mil, cônjuge e 2 filhos',
        entrada: caso({
            deceased: { maritalRegime: 'COMUNHAO_PARCIAL', spouseName: 'Cônjuge' },
            heirs: [conjuge, ...doisFilhos],
            assets: [bem('comum', 600_000, { origin: 'COMUM' }), bem('particular', 300_000)],
        }),
    },
    {
        id: 'parcial-4-filhos-quarta-parte',
        descricao: 'comunhão parcial com 4 filhos comuns: reserva da 4ª parte nos particulares',
        entrada: caso({
            deceased: { maritalRegime: 'COMUNHAO_PARCIAL', spouseName: 'Cônjuge' },
            heirs: [conjuge, filho('f1'), filho('f2'), filho('f3'), filho('f4')],
            assets: [bem('comum', 400_000, { origin: 'COMUM' }), bem('particular', 800_000)],
        }),
    },
    {
        id: 'separacao-total-2-filhos',
        descricao: 'separação total, cônjuge e 2 filhos',
        entrada: caso({
            deceased: { maritalRegime: 'SEPARACAO_TOTAL', spouseName: 'Cônjuge' },
            heirs: [conjuge, ...doisFilhos],
            assets: [bem('particular', 900_000)],
        }),
    },
    {
        id: 'separacao-obrigatoria-sumula-377',
        descricao: 'separação obrigatória com aquestos (Súmula 377/STF), cônjuge e 1 filho',
        entrada: caso({
            deceased: { maritalRegime: 'SEPARACAO_OBRIGATORIA', spouseName: 'Cônjuge' },
            heirs: [conjuge, filho('f1')],
            assets: [bem('comum', 500_000, { origin: 'COMUM' }), bem('particular', 500_000)],
        }),
    },
    {
        id: 'uniao-estavel-sem-conjuge-cadastrado',
        descricao: 'regime de união estável preenchido, sem companheiro(a) cadastrado — sem meação',
        entrada: caso({
            deceased: { maritalRegime: 'UNIAO_ESTAVEL' },
            heirs: doisFilhos,
            assets: [bem('comum', 1_000_000, { origin: 'COMUM' })],
        }),
    },
    {
        id: 'meeiro-so-com-isSpouse',
        descricao: 'meeiro cadastrado só com isSpouse (sem type CONJUGE e sem spouseName)',
        entrada: caso({
            deceased: { maritalRegime: 'COMUNHAO_PARCIAL' },
            heirs: [{ id: 'meeira', name: 'Meeira', type: 'OUTROS', isSpouse: true }, ...doisFilhos],
            assets: [bem('comum', 1_000_000, { origin: 'COMUM' })],
        }),
        divergenciaLegada: [
            {
                caminho: /^(total\.(totalMeacao|successionBase|netEstate|disposablePortion|compulsoryPortion|taxBase|taxAmount)|alvo\[(meeira|f1|f2)\]\.|itcd\[SP\]\.(taxBase|taxAmount|originalTaxAmount|registryFee)|total\.(registryFee|notaryFee))/,
                motivo: 'o backend só reconhecia o meeiro por type CONJUGE: sem meação, metade do comum ia aos filhos e ao ITCD. Vale o frontend (isSpouse e spouse_auto também identificam o meeiro).',
            },
        ],
    },
    {
        id: 'ascendentes-com-conjuge',
        descricao: 'sem descendentes: pai, mãe e cônjuge (art. 1.837)',
        entrada: caso({
            deceased: { maritalRegime: 'SEPARACAO_TOTAL', spouseName: 'Cônjuge' },
            heirs: [conjuge, { id: 'pai', name: 'Pai', type: 'ASCENDENTE', subtype: 'PAI' }, { id: 'mae', name: 'Mãe', type: 'ASCENDENTE', subtype: 'PAI' }],
            assets: [bem('particular', 900_000)],
        }),
    },
    {
        id: 'colaterais-sobrinho-representa',
        descricao: 'colaterais: irmão vivo e sobrinho representando irmão pré-morto (vínculo reconstruído)',
        entrada: caso({
            heirs: [
                { id: 'i1', name: 'Irmão', type: 'COLATERAL', subtype: 'IRMAO' },
                { id: 'i2', name: 'Irmã pré-morta', type: 'COLATERAL', subtype: 'IRMAO', isPreDeceased: true },
                { id: 's1', name: 'Sobrinho', type: 'COLATERAL', subtype: 'SOBRINHO' },
            ],
            assets: [bem('imovel', 600_000, { state: 'RS' })],
        }),
    },
    {
        id: 'filho-premorto-netos',
        descricao: 'filho pré-morto representado por 2 netos, mais 1 filho vivo (BA)',
        entrada: caso({
            heirs: [filho('f1'), filho('f2', { isPreDeceased: true }), filho('n1', { subtype: 'NETO', parentId: 'f2' }), filho('n2', { subtype: 'NETO', parentId: 'f2' })],
            assets: [bem('imovel', 800_000, { state: 'BA' })],
        }),
        mudancas: [CALC01('BA', 'netos com quinhão de R$ 200.000 (4%) e filho com R$ 400.000 (8%) — R$ 64.000 viram R$ 48.000')],
    },
    {
        id: 'renuncia-de-um-filho',
        descricao: 'um dos 3 filhos renuncia (art. 1.811)',
        entrada: caso({
            heirs: [filho('f1'), filho('f2', { successionExclusion: 'RENUNCIA' }), filho('f3')],
            assets: [bem('imovel', 900_000)],
        }),
    },

    // ------------------------------------------------------------ testamento e colação
    {
        id: 'testamento-quota-50',
        descricao: 'quota testamentária de 50% a terceiro, 1 filho',
        entrada: caso({
            deceased: { hasWill: true },
            heirs: [filho('f1'), { id: 't1', name: 'Legatário', type: 'TESTAMENTARIO', testamentaryMode: 'PERCENTAGE_OF_ESTATE', testamentaryPercentage: 50 }],
            assets: [bem('imovel', 1_000_000)],
        }),
    },
    {
        id: 'testamento-legado-excessivo',
        descricao: 'legado de bem específico de R$ 700 mil num monte de R$ 1 milhão, 1 filho',
        entrada: caso({
            deceased: { hasWill: true },
            heirs: [filho('f1'), { id: 't1', name: 'Legatário', type: 'TESTAMENTARIO', testamentaryMode: 'SPECIFIC_ASSETS' }],
            assets: [
                bem('legado', 700_000, { assignments: [{ personId: 't1', percentage: 100, value: 700_000, lockReason: 'TESTAMENT' }] }),
                bem('outro', 300_000),
            ],
        }),
    },
    {
        id: 'testamento-sem-necessarios',
        descricao: 'irmãos e testamento de 100% a terceiro: sem legítima a proteger (art. 1.789)',
        entrada: caso({
            deceased: { hasWill: true },
            heirs: [
                { id: 'i1', name: 'Irmão', type: 'COLATERAL', subtype: 'IRMAO' },
                { id: 't1', name: 'Legatário', type: 'TESTAMENTARIO', testamentaryMode: 'PERCENTAGE_OF_ESTATE', testamentaryPercentage: 100 },
            ],
            assets: [bem('imovel', 500_000)],
        }),
    },
    {
        id: 'adiantamento-colacao',
        descricao: 'adiantamento de legítima de R$ 200 mil a um dos 2 filhos',
        entrada: caso({
            heirs: doisFilhos,
            assets: [bem('imovel', 1_000_000), bem('adiant', 200_000, { type: 'ADIANTAMENTO', beneficiaryId: 'f1', state: undefined })],
        }),
    },
    {
        id: 'adiantamento-excede-quinhao',
        descricao: 'adiantamento maior que o quinhão (arts. 2.002/2.003)',
        entrada: caso({
            heirs: tresFilhos,
            assets: [bem('imovel', 300_000), bem('adiant', 400_000, { type: 'ADIANTAMENTO', beneficiaryId: 'f1', state: undefined })],
        }),
    },

    // ------------------------------------------------------------ passivo (CALC-04 e CALC-05)
    {
        id: 'passivo-espolio-legado-450k',
        descricao: 'CALC-04: monte 1 mi, dívida do espólio 600 mil, 1 filho, legado de 450 mil',
        entrada: caso({
            deceased: { hasWill: true },
            heirs: [filho('f1'), { id: 't1', name: 'Legatário', type: 'TESTAMENTARIO', testamentaryMode: 'SPECIFIC_ASSETS' }],
            assets: [
                bem('legado', 450_000, { assignments: [{ personId: 't1', percentage: 100, value: 450_000, lockReason: 'TESTAMENT' }] }),
                bem('outro', 550_000),
            ],
            liabilities: [{ id: 'd1', description: 'Empréstimo', value: 600_000, origin: 'PARTICULAR', partitionTreatment: 'ESPOLIO' }],
        }),
        mudancas: [
            {
                caminho: /^(total\.(compulsoryPortion|disposablePortion|isTestamentaryExcessive|totalExcessTax)|alvo\[(f1|t1)\]\.|doacao\[f1>t1@SP\]\.)/,
                motivo:
                    'CALC-04: disponível sobre o monte líquido (1 mi − 600 mil) = 200 mil, não 500 mil; o legado de 450 mil passa a ser ' +
                    'excessivo e é reduzido a 200 mil (art. 1.967). Efeito da regra preexistente de excesso de quinhão: o legatário ' +
                    'continua com o bem de 450 mil sendo titular de 200 mil, e os 250 mil a mais aparecem como doação do filho (ITCD de ' +
                    'R$ 10.000) — o aviso DISPOSICAO_INOFICIOSA trava a minuta até o advogado decidir a redução.',
            },
        ],
    },
    {
        id: 'passivo-espolio-quota-50',
        descricao: 'CALC-04: monte 1 mi, dívida do espólio 600 mil, 1 filho, quota testamentária de 50%',
        entrada: caso({
            deceased: { hasWill: true },
            heirs: [filho('f1'), { id: 't1', name: 'Legatário', type: 'TESTAMENTARIO', testamentaryMode: 'PERCENTAGE_OF_ESTATE', testamentaryPercentage: 50 }],
            assets: [bem('imovel', 1_000_000)],
            liabilities: [{ id: 'd1', description: 'Empréstimo', value: 600_000, origin: 'PARTICULAR', partitionTreatment: 'ESPOLIO' }],
        }),
        mudancas: [
            {
                // Revisão (b): a primeira versão desta correção dava 200 mil ao testamentário e 800 mil ao
                // filho (todo o passivo no herdeiro legítimo); o revisor apontou o art. 1.997. Os quinhões
                // voltaram a ser os dos motores antigos (500 mil cada, cada um suportando 300 mil) — só a
                // legítima, a disponível e o total disposto (em valor líquido) mudam.
                caminho: /^total\.(compulsoryPortion|disposablePortion|testamentaryTotal)$/,
                motivo:
                    'CALC-04: legítima e disponível sobre o monte líquido (400 mil): 500 mil viram 200 mil; o disposto pela quota ' +
                    'é medido em valor líquido (50% de 400 mil = 200 mil), cabe na disponível e não há inoficiosidade.',
            },
        ],
    },
    {
        id: 'divida-SP-espolio',
        descricao: 'CALC-05: SP, imóvel 1 mi com dívida de 300 mil tratada como ESPÓLIO, 2 filhos',
        entrada: caso({
            heirs: doisFilhos,
            assets: [bem('imovel', 1_000_000)],
            liabilities: [{ id: 'd1', description: 'Financiamento', value: 300_000, origin: 'PARTICULAR', partitionTreatment: 'ESPOLIO' }],
        }),
        mudancas: [
            {
                caminho: /^total\.(compulsoryPortion|disposablePortion)$/,
                motivo: 'CALC-04: legítima e disponível sobre o monte líquido do passivo do espólio (1 mi − 300 mil): 500 mil viram 350 mil.',
            },
        ],
    },
    {
        id: 'divida-SP-bem-vinculado',
        descricao: 'CALC-05: SP, a mesma dívida vinculada ao imóvel',
        entrada: caso({
            heirs: doisFilhos,
            assets: [bem('imovel', 1_000_000)],
            liabilities: [{ id: 'd1', description: 'Financiamento', value: 300_000, origin: 'PARTICULAR', partitionTreatment: 'BEM_VINCULADO', assetLinks: [{ assetId: 'imovel', deductedValue: 300_000 }] }],
        }),
        mudancas: [
            {
                caminho: /^(itcd\[SP\]\.(taxBase|taxAmount|originalTaxAmount)|total\.taxAmount)$/,
                motivo: 'CALC-05: SP não abate dívida da base (Lei 10.705/2000, art. 12) — base 700 mil → 1 mi e ITCD 28.000 → 40.000, igual aos outros dois tratamentos.',
            },
        ],
    },
    {
        id: 'divida-SP-herdeiro-torna',
        descricao: 'CALC-05: SP, a mesma dívida assumida por um herdeiro (torna)',
        entrada: caso({
            heirs: doisFilhos,
            assets: [bem('imovel', 1_000_000)],
            liabilities: [{ id: 'd1', description: 'Financiamento', value: 300_000, origin: 'PARTICULAR', partitionTreatment: 'HERDEIRO_TORNA', responsibleHeirId: 'f1' }],
        }),
        mudancas: [
            {
                caminho: /^(itcd\[SP\]\.(taxBase|taxAmount|originalTaxAmount)|total\.taxAmount)$/,
                motivo: 'CALC-05: SP não abate dívida da base (Lei 10.705/2000, art. 12) — base 700 mil → 1 mi e ITCD 28.000 → 40.000.',
            },
        ],
    },
    {
        id: 'divida-MG-bem-vinculado',
        descricao: 'CALC-05: MG (sem regra registrada), dívida vinculada ao imóvel',
        entrada: caso({
            deceased: { lastResidenceState: 'MG' },
            heirs: doisFilhos,
            assets: [bem('imovel', 1_000_000, { state: 'MG' })],
            liabilities: [{ id: 'd1', description: 'Financiamento', value: 300_000, origin: 'PARTICULAR', partitionTreatment: 'BEM_VINCULADO', assetLinks: [{ assetId: 'imovel', deductedValue: 300_000 }] }],
            settings: { selectedState: 'MG' },
        }),
    },

    // ------------------------------------------------------------ competência (CALC-03)
    {
        id: 'domicilio-vazio-pos-EC132',
        descricao: 'CALC-03: conta de R$ 1 mi, processo em SP, domicílio do falecido vazio, óbito em 2026',
        entrada: caso({ deceased: { lastResidenceState: undefined }, heirs: [filho('f1')], assets: [conta('conta', 1_000_000)] }),
        mudancas: [
            {
                caminho: /^itcd\[SP\]\.regras$/,
                motivo: 'CALC-03: o rótulo "domicílio do de cujus" saía sem a regra ter sido aplicada; agora MOVEL_DOMICILIO_NAO_INFORMADO (competência indeterminada, SP só como estimativa, aviso que trava a minuta). O valor não muda.',
                contra: 'FRONT',
            },
        ],
    },
    {
        id: 'domicilio-MG-preenchido',
        descricao: 'CALC-03 (controle): o mesmo caso com domicílio em MG',
        entrada: caso({ deceased: { lastResidenceState: 'MG' }, heirs: [filho('f1')], assets: [conta('conta', 1_000_000)] }),
    },
    {
        id: 'obito-pre-EC132',
        descricao: 'óbito em 2023-06-01: móvel segue a UF do processo (regra histórica)',
        entrada: caso({ deceased: { deathDate: '2023-06-01', lastResidenceState: undefined }, heirs: doisFilhos, assets: [conta('conta', 600_000)] }),
    },
    {
        id: 'de-cujus-exterior-sem-sucessor',
        descricao: 'de cujus domiciliado no exterior, UF do sucessor não informada',
        entrada: caso({ deceased: { domiciledAbroad: true, lastResidenceState: undefined }, heirs: doisFilhos, assets: [conta('conta', 600_000)] }),
        mudancas: [
            {
                caminho: /^itcd\[SP\]\.regras$/,
                motivo: 'CALC-03 (mesmo defeito): sem a UF do sucessor, o rótulo era o da regra do sucessor; agora SUCESSOR_DOMICILIO_NAO_INFORMADO. O aviso já existia; o valor não muda.',
                contra: 'FRONT',
            },
        ],
    },
    {
        id: 'imovel-no-exterior',
        descricao: 'imóvel no exterior, de cujus domiciliado em MG',
        entrada: caso({
            deceased: { lastResidenceState: 'MG' },
            heirs: doisFilhos,
            assets: [bem('exterior', 700_000, { state: undefined, location: 'EXTERIOR' })],
        }),
    },

    // ------------------------------------------------------------ doação por excesso de quinhão
    {
        id: 'doacao-excesso-movel',
        descricao: 'conta de R$ 200 mil atribuída inteira a um de 2 filhos (doador em RJ)',
        entrada: caso({
            heirs: [filho('c1', { residenceState: 'MG' }), filho('c2', { residenceState: 'RJ' })],
            assets: [conta('conta', 200_000, { assignments: [{ personId: 'c1', percentage: 100, value: 200_000 }] })],
        }),
    },
    {
        id: 'doacao-excesso-imovel-e-movel',
        descricao: 'imóvel na BA e conta atribuídos a um de 2 filhos',
        entrada: caso({
            heirs: [filho('c1', { residenceState: 'MG' }), filho('c2', { residenceState: 'RJ' })],
            assets: [
                bem('imv', 100_000, { state: 'BA', assignments: [{ personId: 'c1', percentage: 100, value: 100_000 }] }),
                conta('fin', 100_000, { assignments: [{ personId: 'c1', percentage: 100, value: 100_000 }] }),
            ],
        }),
    },
    {
        id: 'doacao-doador-exterior',
        descricao: 'doador no exterior: competência do domicílio do donatário (art. 159, IV)',
        entrada: caso({
            heirs: [filho('c1', { residenceState: 'MG' }), filho('c2', { domiciledAbroad: true })],
            assets: [conta('conta', 200_000, { assignments: [{ personId: 'c1', percentage: 100, value: 200_000 }] })],
        }),
    },
    {
        id: 'doacao-AL-tabela-propria',
        descricao: 'excesso de quinhão em imóvel em AL (tabela própria de doação)',
        entrada: caso({
            heirs: doisFilhos,
            assets: [bem('imv', 400_000, { state: 'AL', assignments: [{ personId: 'f1', percentage: 100, value: 400_000 }] })],
        }),
    },

    // ------------------------------------------------------------ valoração e emolumentos
    {
        id: 'valor-fiscal-no-topo',
        descricao: 'base "valor fiscal" com o valor gravado no topo do bem (stateAssessedValue)',
        entrada: caso({
            heirs: doisFilhos,
            assets: [bem('imovel', 1_000_000, { stateAssessedValue: 600_000 })],
            settings: { assetValuationBasis: 'STATE' },
        }),
        divergenciaLegada: [
            {
                caminho: /^(total\.|alvo\[(f1|f2)\]\.|itcd\[SP\]\.)/,
                motivo: 'o backend só lia otherDetails.stateAssessedValue e caía no valor de mercado. Vale o frontend (lê o topo do bem e depois otherDetails).',
            },
        ],
    },
    {
        id: 'valor-fiscal-em-otherDetails',
        descricao: 'base "valor fiscal" com o valor em otherDetails',
        entrada: caso({
            heirs: doisFilhos,
            assets: [bem('imovel', 1_000_000, { otherDetails: { stateAssessedValue: 600_000 } })],
            settings: { assetValuationBasis: 'STATE' },
        }),
    },
    {
        id: 'titularidade-parcial',
        descricao: 'falecido titular de 50% do imóvel',
        entrada: caso({ heirs: doisFilhos, assets: [bem('imovel', 1_000_000, { ownershipPercentage: 50 })] }),
    },
    {
        id: 'sem-tabelas-de-emolumentos',
        descricao: 'frontend sem as tabelas de emolumentos carregadas',
        entrada: caso({ heirs: doisFilhos, assets: [bem('imovel', 1_000_000)], semTabelas: true }),
        divergenciaLegada: [
            {
                caminho: /^(total\.(notaryFee|deedFee|registryFee)|itcd\[SP\]\.registryFee)$/,
                motivo: 'o frontend sem tabela devolvia 0 e o backend usava as próprias. Agora as tabelas são entrada do motor e a ausência sai em notaryFeeStatus.',
                soEntreLegados: true,
            },
        ],
    },

    // ------------------------------------------------------------ casos do revisor cético
    {
        id: 'revisor-N4-legado-imovel-RS-filho-SP',
        descricao: 'revisão (a): legado do imóvel do RS (450 mil) a terceiro e imóvel de SP (550 mil) ao filho',
        entrada: caso({
            deceased: { hasWill: true },
            heirs: [filho('f1'), { id: 't1', name: 'Legatário', type: 'TESTAMENTARIO', testamentaryMode: 'SPECIFIC_ASSETS' }],
            assets: [
                bem('rs', 450_000, { state: 'RS', assignments: [{ personId: 't1', percentage: 100, value: 450_000, lockReason: 'TESTAMENT' }] }),
                bem('sp', 550_000),
            ],
        }),
        // Sem mudança de número: cada UF tem um só beneficiário (o legatário no RS, o filho em SP),
        // e os motores antigos já davam 18.000 + 22.000. A primeira versão unificada dava 35.500.
    },
    {
        id: 'revisor-H-legado-conta-filho-RS',
        descricao: 'revisão (a): legado de conta (domicílio SP) a terceiro e imóvel do RS (600 mil) ao filho',
        entrada: caso({
            deceased: { hasWill: true },
            heirs: [filho('f1'), { id: 'l1', name: 'l1', type: 'TESTAMENTARIO', testamentaryMode: 'SPECIFIC_ASSETS' }],
            assets: [
                conta('c', 400_000, { assignments: [{ personId: 'l1', percentage: 100, value: 400_000, lockReason: 'TESTAMENT' }] }),
                bem('i', 600_000, { state: 'RS' }),
            ],
        }),
    },
    {
        id: 'revisor-C7c-quota-50-RS',
        descricao: 'revisão (b): quota de 50% e dívida do espólio de 600 mil, imóvel no RS',
        entrada: caso({
            deceased: { hasWill: true, lastResidenceState: 'RS' },
            heirs: [filho('f1'), { id: 't1', name: 't1', type: 'TESTAMENTARIO', testamentaryMode: 'PERCENTAGE_OF_ESTATE', testamentaryPercentage: 50 }],
            assets: [bem('i', 1_000_000, { state: 'RS' })],
            liabilities: [{ id: 'd1', description: 'd', value: 600_000, origin: 'PARTICULAR', partitionTreatment: 'ESPOLIO' }],
            settings: { selectedState: 'RS' },
        }),
        mudancas: [
            CALC01('RS', 'dois quinhões de 500 mil (17.651 UPF-RS, 4%) em vez de 1 mi a 5% — R$ 50.000 viram R$ 40.000'),
            {
                caminho: /^total\.(compulsoryPortion|disposablePortion|testamentaryTotal)$/,
                motivo: 'CALC-04: legítima e disponível sobre o monte líquido; disposto medido em valor líquido.',
            },
        ],
    },
    {
        id: 'revisor-d-SP-vinculada-maior-que-o-bem',
        descricao: 'revisão (d): SP, imóvel de 300 mil com financiamento vinculado de 500 mil, 1 filho',
        entrada: caso({
            heirs: [filho('f1')],
            assets: [bem('i', 300_000)],
            liabilities: [{ id: 'd', description: 'd', value: 500_000, origin: 'PARTICULAR', partitionTreatment: 'BEM_VINCULADO', assetLinks: [{ assetId: 'i', deductedValue: 500_000 }] }],
        }),
        mudancas: [
            {
                caminho: /^(itcd\[SP\]\.(taxBase|taxAmount|originalTaxAmount|effectiveRate|confiabilidade|regras|assetCount|registryFee)|total\.taxAmount)$/,
                motivo:
                    'CALC-05 + revisão (d): SP não abate dívida (Lei 10.705/2000, art. 12) — base 300 mil e R$ 12.000, rateados pelo ' +
                    'quinhão legal sobre o valor bruto; os motores antigos não tinham item de SP (base líquida negativa).',
            },
        ],
    },

    {
        id: 'revisor2-legado-de-bem-comum',
        descricao: 'revisão 2 (CC, art. 1.914): imóvel comum de 600 mil legado por inteiro; particular de 400 mil; cônjuge e 1 filho',
        entrada: caso({
            deceased: { hasWill: true, maritalRegime: 'COMUNHAO_PARCIAL', spouseName: 'Cônjuge' },
            heirs: [{ id: 'conj', name: 'Cônjuge', type: 'CONJUGE' }, filho('f1'), { id: 't1', name: 't1', type: 'TESTAMENTARIO', testamentaryMode: 'SPECIFIC_ASSETS' }],
            assets: [
                bem('comum', 600_000, { origin: 'COMUM', assignments: [{ personId: 't1', percentage: 100, value: 600_000, lockReason: 'TESTAMENT' }] }),
                bem('particular', 400_000),
            ],
        }),
        mudancas: [
            {
                caminho: /^(alvo\[(conj|f1|t1)\]\.|doacao\[|total\.(isTestamentaryExcessive|testamentaryTotal|totalExcessTax)$)/,
                motivo:
                    'Revisão 2 — CC, art. 1.914: o legado do bem comum vale 300 mil (a metade do falecido), não 600 mil; deixa de ser ' +
                    'inoficioso e sai da massa comum, então o cônjuge concorre no particular inteiro (200 mil) e o filho fica com 200 mil. ' +
                    'O rascunho ainda atribui o bem inteiro ao legatário: pela regra preexistente de excesso de quinhão, os 300 mil a mais ' +
                    'aparecem como doação do cônjuge e do filho — o aviso LEGADO_LIMITADO_A_PARTE_DO_TESTADOR pede o ajuste da atribuição.',
            },
        ],
    },
    {
        id: 'revisor2-exterior-sucessores-RS-MG',
        descricao: 'revisão 2: de cujus no exterior, conta de 1 mi, sucessores no RS e em MG',
        entrada: caso({
            deceased: { domiciledAbroad: true, lastResidenceState: undefined, successorDomicileState: 'SP' },
            heirs: [filho('f1', { residenceState: 'RS' }), filho('f2', { residenceState: 'MG' })],
            assets: [conta('c', 1_000_000)],
        }),
        mudancas: [
            {
                caminho: /^(itcd\[(MG|RS|SP)\]\.|total\.taxAmount$)/,
                motivo:
                    'Revisão 2: ITCD apurado por sucessor (LC 227/2026, arts. 158, III, e 159, II) — RS 20.000 (f1) + MG 25.000 (f2) = ' +
                    '45.000, em vez de R$ 40.000 inteiros na UF única informada no falecido (SP).',
            },
        ],
    },

    // ------------------------------------------------------------ centavos (CALC-08)
    {
        id: 'centavos-7-herdeiros',
        descricao: 'R$ 100.000,01 entre 7 filhos',
        entrada: caso({
            heirs: [1, 2, 3, 4, 5, 6, 7].map(n => filho(`f${n}`)),
            assets: [conta('conta', 100_000.01)],
        }),
    },
];
