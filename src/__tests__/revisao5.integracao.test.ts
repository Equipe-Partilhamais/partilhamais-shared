import { describe, expect, it } from 'vitest';
import { calculatePartition } from '../services/partilha/motor';
import { hashDoResultado, serializarResultadoCanonico, sha256Hex } from '../services/partilha/hash';
import { isAssetIncludedInOfficialPartition, montarConjugeDaEntrada } from '../services/partilha/entrada';
import { bem, caso, conta, filho } from './caracterizacao/cenarios';

// O pacote não depende de @types/node (roda também no navegador); o teste usa o crypto do Node só
// como referência do sha256 — mesmo padrão de golden.arquivo.ts.
type Hash = { update(texto: string, codificacao: 'utf8'): Hash; digest(formato: 'hex'): string };
declare function require(modulo: 'node:crypto'): { createHash(algoritmo: 'sha256'): Hash };
const { createHash } = require('node:crypto');

// Divergências entre tela, minuta e servidor achadas na integração (provas em
// rev-integracao/partilhamais-frontend/src/__tests__/revisor/).

const embaralhar = <T,>(xs: T[], semente: number): T[] => {
    const a = [...xs];
    let s = semente;
    for (let i = a.length - 1; i > 0; i--) {
        s = (s * 1103515245 + 12345) % 2147483648;
        const j = s % (i + 1);
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
};

describe('1. o resultado não depende da ordem de entrada', () => {
    it('PROVA 4: R$ 100.000 entre 3 filhos em ordens diferentes (tela por criação, servidor por id) → mesmo centavo', () => {
        const herdeiros = [filho('c3f1'), filho('0a77'), filho('7b20')];
        const entrada = (heirs: any[]) => caso({ deceased: { lastResidenceState: 'RS' }, heirs, assets: [bem('i1', 100_000, { state: 'RS' })], settings: { selectedState: 'RS' } });
        const tela = calculatePartition(entrada(herdeiros));
        const servidor = calculatePartition(entrada([...herdeiros].sort((a, b) => (a.id < b.id ? -1 : 1))));
        const quinhao = (r: ReturnType<typeof calculatePartition>) => Object.fromEntries(r.targets.map(t => [t.personId, t.totalTargetValue]));
        expect(quinhao(tela)).toEqual(quinhao(servidor));
        expect(hashDoResultado(tela)).toBe(hashDoResultado(servidor));
        // A tela continua recebendo os alvos na ordem em que mandou os herdeiros.
        expect(tela.targets.map(t => t.personId)).toEqual(['c3f1', '0a77', '7b20']);
    });

    it('embaralhar herdeiros, bens, atribuições e passivos não muda nenhum centavo (nem o hash)', () => {
        const base = caso({
            deceased: { maritalRegime: 'COMUNHAO_PARCIAL', spouseName: 'C', hasWill: true },
            heirs: [
                { id: 'conj', name: 'C', type: 'CONJUGE' },
                filho('k1'), filho('a9'), filho('m4'),
                { id: 't1', name: 'T', type: 'TESTAMENTARIO', testamentaryMode: 'PERCENTAGE_OF_ESTATE', testamentaryPercentage: 10 },
            ],
            assets: [
                bem('z1', 333_333.33, { origin: 'COMUM', state: 'RS', assignments: [{ personId: 'k1', percentage: 33.33 }, { personId: 'a9', percentage: 33.33 }, { personId: 'm4', percentage: 33.34 }] }),
                bem('b2', 100_000.01, { state: 'BA' }),
                conta('c3', 77_777.77, { assignments: [{ personId: 'm4', percentage: 100 }] }),
                bem('ad', 10_000, { type: 'ADIANTAMENTO', beneficiaryId: 'a9', state: undefined }),
            ],
            liabilities: [
                { id: 'l2', description: 'd', value: 12_345.67, origin: 'COMUM', partitionTreatment: 'ESPOLIO' },
                { id: 'l1', description: 'v', value: 51_000, origin: 'COMUM', partitionTreatment: 'BEM_VINCULADO', assetLinks: [{ assetId: 'z1', deductedValue: 50_000 }, { assetId: 'b2', deductedValue: 1_000 }] },
            ],
        });
        const referencia = serializarResultadoCanonico(calculatePartition(base));
        for (const semente of [1, 7, 42, 99]) {
            const outra = {
                ...base,
                heirs: embaralhar(base.heirs, semente),
                assets: embaralhar(base.assets, semente + 1).map((a: any) => ({ ...a, assignments: embaralhar(a.assignments || [], semente + 2) })),
                liabilities: embaralhar(base.liabilities, semente + 3).map((l: any) => ({ ...l, assetLinks: l.assetLinks && embaralhar(l.assetLinks, semente + 4) })),
            };
            expect(serializarResultadoCanonico(calculatePartition(outra))).toBe(referencia);
        }
    });
});

describe('2. visão da partilha como entrada explícita (`visao`)', () => {
    const entrada = caso({
        heirs: [filho('f1'), filho('f2')],
        assets: [
            bem('i1', 1_000_000, { otherDetails: { stateAssessedValue: 600_000 } }),
            bem('x', 400_000, { otherDetails: { includeInOfficial: false } }),
        ],
    });

    it('padrão: valor de mercado e todos os bens, declarado no resultado', () => {
        const r = calculatePartition(entrada);
        expect(r.visao).toEqual({ baseDeAvaliacao: 'MARKET', filtroDeBens: 'TODOS', bensForaDaPartilha: [] });
        expect(r.herancaTotal).toBe(1_400_000);
    });

    it('visão oficial pedida pela entrada: base fiscal e só os bens marcados, igual à tela de Partilha', () => {
        const r = calculatePartition({ ...entrada, visao: { baseDeAvaliacao: 'STATE', filtroDeBens: 'PARTILHA_OFICIAL' } });
        expect(r.visao).toEqual({ baseDeAvaliacao: 'STATE', filtroDeBens: 'PARTILHA_OFICIAL', bensForaDaPartilha: ['x'] });
        expect(r.herancaTotal).toBe(600_000);
        const comoATelaFazia = calculatePartition({
            ...entrada,
            assets: entrada.assets.filter(isAssetIncludedInOfficialPartition),
            settings: { ...entrada.settings, assetValuationBasis: 'STATE' },
        });
        expect(r.targets.map(t => t.totalTargetValue)).toEqual(comoATelaFazia.targets.map(t => t.totalTargetValue));
        expect(r.taxAmount).toBe(comoATelaFazia.taxAmount);
    });

    it('includeInOfficial no topo do bem prevalece sobre otherDetails (mesma regra da tela)', () => {
        expect(isAssetIncludedInOfficialPartition({ includeInOfficial: true, otherDetails: { includeInOfficial: false } })).toBe(true);
        expect(isAssetIncludedInOfficialPartition({ includeInOfficial: false, otherDetails: {} })).toBe(false);
        expect(isAssetIncludedInOfficialPartition({ otherDetails: { includeInOfficial: false } })).toBe(false);
        expect(isAssetIncludedInOfficialPartition({})).toBe(true);
    });

    it('settings.assetValuationBasis continua valendo quando a visão não é informada', () => {
        expect(calculatePartition({ ...entrada, settings: { ...entrada.settings, assetValuationBasis: 'STATE' } }).visao.baseDeAvaliacao).toBe('STATE');
    });
});

describe('3. cônjuge montado num lugar só (`montarConjugeDaEntrada`)', () => {
    const base = {
        deceased: { maritalRegime: 'COMUNHAO_PARCIAL', spouseName: 'Joana', spouseQualification: { successionExclusion: 'RENUNCIA', residenceState: 'MG' } },
        assets: [bem('p', 600_000, { state: 'MG' }), bem('c', 400_000, { state: 'MG', origin: 'COMUM' })],
    };

    it('PROVA 5: renúncia gravada em spouseQualification — servidor (sem a linha do cônjuge) e tela dão o mesmo resultado', () => {
        const conjugeNaTela = { id: 'spouse_auto', name: 'Joana', type: 'CONJUGE', isSpouse: true, subtype: 'OUTRO', successionExclusion: 'RENUNCIA', residenceState: 'MG' };
        const tela = calculatePartition(caso({ ...base, heirs: [filho('f1'), filho('f2'), conjugeNaTela] }));
        const servidor = calculatePartition(caso({ ...base, heirs: [filho('f1'), filho('f2')] }));
        const conj = servidor.targets.find(t => t.personId === 'spouse_auto')!;
        expect(conj.meacaoValue).toBe(200_000);
        expect(conj.inheritanceValue).toBe(0); // renunciou: meeira, não herdeira
        expect(hashDoResultado(servidor)).toBe(hashDoResultado(tela));
    });

    it('a função devolve os herdeiros com o cônjuge hidratado do falecido', () => {
        const heirs = montarConjugeDaEntrada(base.deceased as any, [filho('f1') as any]);
        expect(heirs.find(h => h.id === 'spouse_auto')).toEqual(
            expect.objectContaining({ name: 'Joana', type: 'CONJUGE', isSpouse: true, successionExclusion: 'RENUNCIA', residenceState: 'MG' })
        );
    });

    it('com cônjuge já cadastrado, a qualificação do falecido completa o cadastro (sem duplicar)', () => {
        const heirs = montarConjugeDaEntrada(base.deceased as any, [{ id: 'c1', name: 'Joana', type: 'CONJUGE', residenceState: 'SP' } as any, filho('f1') as any]);
        expect(heirs.filter(h => h.type === 'CONJUGE' || h.isSpouse)).toHaveLength(1);
        expect(heirs.find(h => h.id === 'c1')?.successionExclusion).toBe('RENUNCIA');
        // A qualificação do falecido é a fonte única na tela: prevalece sobre o cadastro.
        expect(heirs.find(h => h.id === 'c1')?.residenceState).toBe('MG');
    });

    it('dois cadastros de cônjuge: o motor usa o mesmo que recebeu a qualificação, em qualquer ordem (e avisa)', () => {
        const duplicado = [
            { id: 'c-conj', name: 'Joana', type: 'CONJUGE' },
            { id: 'spouse_auto', name: 'Joana', type: 'CONJUGE', isSpouse: true },
            filho('f1'),
        ];
        const r = calculatePartition(caso({ ...base, heirs: duplicado }));
        const invertido = calculatePartition(caso({ ...base, heirs: [...duplicado].reverse() }));
        const meeiro = r.targets.find(t => t.meacaoValue > 0)!;
        expect(meeiro.personId).toBe('spouse_auto');
        expect(meeiro.inheritanceValue).toBe(0); // a renúncia foi para o spouse_auto
        expect(r.avisos.map(a => a.codigo)).toContain('MAIS_DE_UM_CONJUGE');
        expect(hashDoResultado(invertido)).toBe(hashDoResultado(r));
    });

    it('regime SOLTEIRO não cria cônjuge', () => {
        expect(montarConjugeDaEntrada({ ...base.deceased, maritalRegime: 'SOLTEIRO' } as any, [filho('f1') as any]).map(h => h.id)).toEqual(['f1']);
    });
});

describe('4. montes com definição explícita (`montes`) e total testamentário (`testamento`)', () => {
    it('PROVA 3: imóvel de 1 mi com financiamento de 300 mil e adiantamento de 200 mil', () => {
        const r = calculatePartition(
            caso({
                heirs: [filho('f1'), filho('f2')],
                assets: [bem('i1', 1_000_000), bem('adt', 200_000, { type: 'ADIANTAMENTO', beneficiaryId: 'f1', state: undefined })],
                liabilities: [{ id: 'l1', description: 'Financiamento', value: 300_000, partitionTreatment: 'BEM_VINCULADO', assetLinks: [{ assetId: 'i1', deductedValue: 300_000 }] }],
            })
        );
        expect(r.montes).toEqual({
            bensBrutos: 1_000_000,
            passivoVinculado: 300_000,
            passivoAssumidoPorHerdeiros: 0,
            herancaFisica: 700_000,
            meacao: 0,
            montePartilhavel: 700_000,
            colacao: 200_000,
            monteComColacao: 900_000,
            passivoDoEspolio: 0,
            passivoDoEspolioNaHeranca: 0,
            monteLiquido: 700_000,
        });
        expect(r.montes.monteComColacao).toBe(r.totalAssets);
    });
});

describe('4b. montes com meação e os três tratamentos de passivo', () => {
    it('comum de 1 mi com 100 mil assumidos e 50 mil do espólio; particular de 200 mil com 20 mil assumidos', () => {
        const r = calculatePartition(
            caso({
                deceased: { maritalRegime: 'COMUNHAO_PARCIAL', spouseName: 'Joana' },
                heirs: [{ id: 'c1', name: 'Joana', type: 'CONJUGE', isSpouse: true }, filho('f1'), filho('f2')],
                assets: [bem('A', 1_000_000, { origin: 'COMUM' }), bem('P', 200_000, { origin: 'PARTICULAR' })],
                liabilities: [
                    { id: 'ht', description: 'Assumida', value: 100_000, origin: 'COMUM', partitionTreatment: 'HERDEIRO_TORNA' },
                    { id: 'htp', description: 'Assumida particular', value: 20_000, origin: 'PARTICULAR', partitionTreatment: 'HERDEIRO_TORNA' },
                    { id: 'esp', description: 'Espólio', value: 50_000, origin: 'COMUM', partitionTreatment: 'ESPOLIO' },
                ],
            })
        );
        // Comum líquido 900 mil → meação 450 mil; particular líquido 180 mil; partilhável 630 mil; a meação suporta
        // metade do passivo comum do espólio, então 25 mil oneram a herança.
        expect(r.montes).toEqual({
            bensBrutos: 1_200_000,
            passivoVinculado: 0,
            passivoAssumidoPorHerdeiros: 120_000,
            herancaFisica: 1_080_000,
            meacao: 450_000,
            montePartilhavel: 630_000,
            colacao: 0,
            monteComColacao: 630_000,
            passivoDoEspolio: 50_000,
            passivoDoEspolioNaHeranca: 25_000,
            monteLiquido: 605_000,
        });
        expect(r.montes.herancaFisica).toBe(r.herancaTotal);
        expect(r.montes.meacao).toBe(r.totalMeacao);
        expect(r.montes.montePartilhavel).toBe(r.taxBase);
        expect(r.montes.monteLiquido).toBe(r.monteLiquido);
    });
});

describe('5. fatores de redução por disposição (art. 1.967, § 1º)', () => {
    it('PROVA 1: quota de 30% e legado de 400 mil com disponível de 500 mil — reduz só a quota (fator 1/3), o legado fica inteiro', () => {
        const r = calculatePartition(
            caso({
                deceased: { hasWill: true },
                heirs: [
                    filho('f1'),
                    { id: 't1', name: 'Quotista', type: 'TESTAMENTARIO', testamentaryMode: 'PERCENTAGE_OF_ESTATE', testamentaryPercentage: 30 },
                    { id: 'l1', name: 'Legatario', type: 'TESTAMENTARIO', testamentaryMode: 'SPECIFIC_ASSETS' },
                ],
                assets: [bem('A', 600_000), bem('B', 400_000, { assignments: [{ personId: 'l1', percentage: 100, value: 400_000, lockReason: 'TESTAMENT' }] })],
            })
        );
        expect(r.testamento.disponivel).toBe(500_000);
        expect(r.testamento.dispostoLiquido).toBe(700_000);
        expect(r.testamento.fatorQuota).toBeCloseTo(1 / 3, 12);
        expect(r.testamento.fatorLegado).toBe(1);
        const quota = r.testamento.disposicoes.find(d => d.personId === 't1')!;
        expect(quota.fatorDeReducao).toBeCloseTo(1 / 3, 12);
        expect(quota).toEqual(expect.objectContaining({ tipo: 'QUOTA', percentual: 30, percentualAposReducao: 10, valorAposReducao: 100_000, dispostoLiquido: 300_000 }));
        const legado = r.testamento.disposicoes.find(d => d.personId === 'l1')!;
        expect(legado.itens).toEqual([
            expect.objectContaining({ assetId: 'B', percentualOriginal: 100, valorLegado: 400_000, valorValido: 400_000, valorAposReducao: 400_000, percentualAposReducao: 100 }),
        ]);
        expect(r.testamento.atribuidoBruto).toBe(500_000);
    });

    it('só legado, acima do disponível: fator do legado < 1 em cada item e na disposição', () => {
        const r = calculatePartition(
            caso({
                deceased: { hasWill: true },
                heirs: [filho('f1'), { id: 'l1', name: 'Legatario', type: 'TESTAMENTARIO', testamentaryMode: 'SPECIFIC_ASSETS' }],
                assets: [bem('A', 200_000), bem('B', 800_000, { assignments: [{ personId: 'l1', percentage: 100, value: 800_000, lockReason: 'TESTAMENT' }] })],
            })
        );
        // Disponível 500 mil; legado de 800 mil reduzido a 5/8.
        expect(r.testamento.fatorLegado).toBe(0.625);
        const legado = r.testamento.disposicoes.find(d => d.personId === 'l1')!;
        expect(legado).toEqual(expect.objectContaining({ tipo: 'LEGADO', percentual: null, fatorDeReducao: 0.625, dispostoLiquido: 800_000, valorAposReducao: 500_000 }));
        expect(legado.itens).toEqual([
            expect.objectContaining({ assetId: 'B', valorLegado: 800_000, valorValido: 800_000, valorAposReducao: 500_000, percentualAposReducao: 62.5 }),
        ]);
        expect(r.testamento.atribuidoBruto).toBe(500_000);
    });

    it('PROVA 2: legado de bem comum com financiamento — o total do motor já vem com o art. 1.914 e a dívida', () => {
        const r = calculatePartition(
            caso({
                deceased: { hasWill: true, maritalRegime: 'COMUNHAO_PARCIAL', spouseName: 'Joana' },
                heirs: [{ id: 'c1', name: 'Joana', type: 'CONJUGE', isSpouse: true }, filho('f1'), { id: 'l1', name: 'Legatario', type: 'TESTAMENTARIO', testamentaryMode: 'SPECIFIC_ASSETS' }],
                assets: [
                    bem('A', 600_000, { origin: 'COMUM' }),
                    bem('B', 400_000, { origin: 'COMUM', assignments: [{ personId: 'l1', percentage: 100, value: 400_000, lockReason: 'TESTAMENT' }] }),
                ],
                liabilities: [{ id: 'fin', description: 'Financiamento', value: 100_000, partitionTreatment: 'BEM_VINCULADO', assetLinks: [{ assetId: 'B', deductedValue: 100_000 }] }],
            })
        );
        // Líquido do bem 300 mil; metade do falecido 150 mil (art. 1.914).
        const item = r.testamento.disposicoes.find(d => d.personId === 'l1')!.itens[0];
        expect(item).toEqual(expect.objectContaining({ valorLegado: 300_000, valorValido: 150_000, percentualAposReducao: 50 }));
        expect(r.testamento.dispostoLiquido).toBe(r.testamentaryTotal);
        expect(r.testamentaryTotal).toBe(150_000);
    });
});

describe('6. hash canônico do resultado (`hashDoResultado`, `serializarResultadoCanonico`, `sha256Hex`)', () => {
    it('sha256 puro confere com os vetores do padrão e com o crypto do Node', () => {
        expect(sha256Hex('')).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
        expect(sha256Hex('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
        const texto = 'Meação — R$ 1.000,00 ção ✓ ' + 'x'.repeat(200);
        expect(sha256Hex(texto)).toBe(createHash('sha256').update(texto, 'utf8').digest('hex'));
    });

    it('o hash é o sha256 da serialização canônica, com chaves ordenadas', () => {
        const r = calculatePartition(caso({ heirs: [filho('f1')], assets: [bem('i', 100_000)] }));
        const canonico = serializarResultadoCanonico(r);
        expect(hashDoResultado(r)).toBe(createHash('sha256').update(canonico, 'utf8').digest('hex'));
        expect(canonico.indexOf('"avisos"')).toBeLessThan(canonico.indexOf('"targets"'));
    });

    it('um centavo a mais em qualquer alvo muda o hash', () => {
        const r = calculatePartition(caso({ heirs: [filho('f1'), filho('f2')], assets: [bem('i', 100_000)] }));
        const adulterado = { ...r, targets: r.targets.map((t, i) => (i === 1 ? { ...t, totalTargetValue: t.totalTargetValue + 0.01 } : t)) };
        expect(hashDoResultado(adulterado)).not.toBe(hashDoResultado(r));
    });
});
