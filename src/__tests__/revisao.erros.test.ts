import { describe, expect, it } from 'vitest';
import { calculatePartition } from '../services/partilha/motor';
import { bem, caso, conta, filho } from './caracterizacao/cenarios';

// Erros apontados pelo revisor cético (conferência à mão do motor unificado). Os cenários são
// os roteiros dele (`rev-calculo/rev/cenariosRevisor.ts` e `rev-calc2/rev/cenarios2.ts`).

const uf = (r: ReturnType<typeof calculatePartition>, estado: string) => r.itcdBreakdown.find(i => i.state === estado);
const guias = (r: ReturnType<typeof calculatePartition>, estado: string) =>
    (uf(r, estado)?.beneficiarios || []).map(b => [b.personId, b.base, b.taxAmount]);
const legatario = (id: string) => ({ id, name: id, type: 'TESTAMENTARIO', testamentaryMode: 'SPECIFIC_ASSETS' });

describe('(a) legado de bem certo fica na UF do próprio bem (CC, art. 1.923; CF, art. 155, § 1º, I)', () => {
    it('N4: imóvel do RS (450 mil) legado a terceiro e imóvel de SP (550 mil) ao filho → RS 18.000 do legatário, SP 22.000 do filho', () => {
        const r = calculatePartition(
            caso({
                deceased: { hasWill: true },
                heirs: [filho('f1'), legatario('t1')],
                assets: [
                    bem('rs', 450_000, { state: 'RS', assignments: [{ personId: 't1', percentage: 100, lockReason: 'TESTAMENT' }] }),
                    bem('sp', 550_000),
                ],
            })
        );
        expect(guias(r, 'RS')).toEqual([['t1', 450_000, 18_000]]);
        expect(guias(r, 'SP')).toEqual([['f1', 550_000, 22_000]]);
        expect(r.taxAmount).toBe(40_000);
    });

    it('H: legado de conta (móvel, domicílio SP) a terceiro e imóvel do RS ao filho → 16.000 + 24.000', () => {
        const r = calculatePartition(
            caso({
                deceased: { hasWill: true },
                heirs: [filho('f1'), legatario('l1')],
                assets: [
                    conta('c', 400_000, { assignments: [{ personId: 'l1', percentage: 100, lockReason: 'TESTAMENT' }] }),
                    bem('i', 600_000, { state: 'RS' }),
                ],
            })
        );
        expect(guias(r, 'SP')).toEqual([['l1', 400_000, 16_000]]);
        expect(guias(r, 'RS')).toEqual([['f1', 600_000, 24_000]]);
        expect(r.taxAmount).toBe(40_000);
    });

    it('legado reduzido por inoficiosidade: só a parte que vale fica com o legatário, na UF do bem', () => {
        const r = calculatePartition(
            caso({
                deceased: { hasWill: true },
                heirs: [filho('f1'), legatario('t1')],
                assets: [
                    bem('rs', 800_000, { state: 'RS', assignments: [{ personId: 't1', percentage: 100, lockReason: 'TESTAMENT' }] }),
                    bem('sp', 200_000),
                ],
            })
        );
        // Disponível 500 mil: o legado de 800 mil cai para 500 mil, todo no RS.
        expect(guias(r, 'RS')).toEqual([['f1', 300_000, 12_000], ['t1', 500_000, 20_000]]); // 300 mil = 10.591 UPF-RS → 4%
        expect(guias(r, 'SP')).toEqual([['f1', 200_000, 8_000]]);
    });
});

describe('(b) herdeiro de quota responde pelas dívidas na proporção do quinhão (CC, art. 1.997)', () => {
    const quota50 = (estado: string) =>
        caso({
            deceased: { hasWill: true, lastResidenceState: estado },
            heirs: [filho('f1'), { id: 't1', name: 't1', type: 'TESTAMENTARIO', testamentaryMode: 'PERCENTAGE_OF_ESTATE', testamentaryPercentage: 50 }],
            assets: [bem('i', 1_000_000, { state: estado })],
            liabilities: [{ id: 'd1', description: 'd', value: 600_000, origin: 'PARTICULAR', partitionTreatment: 'ESPOLIO' }],
            settings: { selectedState: estado },
        });

    it('SP: 500 mil bruto, 300 mil de dívida e 200 mil líquidos para cada (1/2); ITCD 20.000 + 20.000', () => {
        const r = calculatePartition(quota50('SP'));
        const alvo = (id: string) => r.targets.find(t => t.personId === id)!;
        for (const id of ['f1', 't1']) {
            expect(alvo(id).theoreticalValue).toBe(500_000);
            expect(alvo(id).passivoDoEspolio).toBe(300_000);
            expect(alvo(id).liquidoProjetado).toBe(200_000);
            expect(alvo(id).fracaoDoMonte?.texto).toBe('1/2');
        }
        expect(r.testamentaryTotal).toBe(200_000); // disposto, em valor líquido
        expect(r.isTestamentaryExcessive).toBe(false);
        expect(guias(r, 'SP')).toEqual([['f1', 500_000, 20_000], ['t1', 500_000, 20_000]]);
    });

    it('RS: 40.000 sem abater e 12.000 abatendo — o aviso de abatimento traz as duas leituras', () => {
        const r = calculatePartition(quota50('RS'));
        expect(r.taxAmount).toBe(40_000);
        expect(r.avisos.find(a => a.codigo === 'ABATIMENTO_DIVIDAS_CONTROVERTIDO')?.valores).toEqual({
            itcdAdotado: 40_000,
            itcdBaseBruta: 40_000,
            itcdTodasAbatidas: 12_000,
        });
    });

    it('o passivo do espólio atribuído aos sucessores soma o passivo inteiro', () => {
        const r = calculatePartition(quota50('SP'));
        expect(r.targets.reduce((s, t) => s + Math.round(t.passivoDoEspolio * 100), 0)).toBe(60_000_000);
    });
});

describe('(c) vigência registrada é conferida contra a data do fato gerador', () => {
    it('BA, óbito em 10/06/2024 (antes de 27/03/2025): cálculo indeterminado, aviso de vigência e trava da minuta', () => {
        const r = calculatePartition(
            caso({ deceased: { deathDate: '2024-06-10' }, heirs: [filho('f1'), filho('f2'), filho('f3')], assets: [bem('i', 300_000, { state: 'BA' })] })
        );
        const ba = uf(r, 'BA')!;
        expect(ba.calculoIndeterminado).toBe(true);
        expect(ba.vigenciaDesde).toBe('2025-03-27');
        expect(r.itcdIndeterminado).toBe(true);
        const aviso = r.avisos.find(a => a.codigo === 'TABELA_FORA_DA_VIGENCIA')!;
        expect(aviso).toEqual(expect.objectContaining({ gravidade: 'EXIGE_CONFIRMACAO', ufs: ['BA'] }));
        expect(aviso.mensagem).toContain('27/03/2025');
        expect(r.minuta.exigeConfirmacao).toBe(true);
    });

    it('BA, óbito em 01/04/2025: dentro da vigência, nada de indeterminado', () => {
        const r = calculatePartition(
            caso({ deceased: { deathDate: '2025-04-01' }, heirs: [filho('f1'), filho('f2'), filho('f3')], assets: [bem('i', 300_000, { state: 'BA' })] })
        );
        expect(uf(r, 'BA')!.calculoIndeterminado).toBe(false);
        expect(r.taxAmount).toBe(0);
        expect(r.avisos.some(a => a.codigo === 'TABELA_FORA_DA_VIGENCIA')).toBe(false);
    });

    it.each([
        ['AL', '2024-06-10'],
        ['RS', '2015-08-01'],
        ['GO', '2015-08-01'],
    ])('%s com óbito em %s, antes da redação registrada: indeterminado', (estado, data) => {
        const r = calculatePartition(caso({ deceased: { deathDate: data }, heirs: [filho('f1')], assets: [bem('i', 500_000, { state: estado })] }));
        expect(uf(r, estado)!.calculoIndeterminado).toBe(true);
    });
});

describe('(d) SP com dívida vinculada maior que o bem', () => {
    const casoD = () =>
        caso({
            heirs: [filho('f1')],
            assets: [bem('i', 300_000)],
            liabilities: [{ id: 'd', description: 'd', value: 500_000, origin: 'PARTICULAR', partitionTreatment: 'BEM_VINCULADO', assetLinks: [{ assetId: 'i', deductedValue: 500_000 }] }],
        });

    it('SP não abate a dívida: base 300 mil e 12.000 de ITCD, rateados pelo quinhão legal', () => {
        const r = calculatePartition(casoD());
        expect(guias(r, 'SP')).toEqual([['f1', 300_000, 12_000]]);
        expect(r.taxAmount).toBe(12_000);
    });

    it('o aviso não manda "cadastrar herdeiros" (o herdeiro existe): é herança insolvente, com trava', () => {
        const r = calculatePartition(casoD());
        expect(r.avisos.some(a => a.codigo === 'ITCD_SEM_BENEFICIARIOS')).toBe(false);
        expect(r.avisos).toEqual(expect.arrayContaining([expect.objectContaining({ codigo: 'HERANCA_INSOLVENTE', gravidade: 'EXIGE_CONFIRMACAO' })]));
    });
});

describe('(e) percentual a partir da fração legal', () => {
    it('cenário 289 do revisor: cônjuge com 1/4 sai 25,0000% (não 24,9998%), filhos 18,75%', () => {
        const r = calculatePartition({
            deceased: { name: 'Falecido', deathDate: '2026-01-01', maritalRegime: 'COMUNHAO_PARCIAL', spouseName: 'C', hasWill: false, lastResidenceState: 'PE' },
            heirs: [
                { id: 'conj', name: 'C', type: 'CONJUGE' },
                { id: 'f0', name: 'f0', type: 'DESCENDENTE', subtype: 'FILHO' },
                { id: 'f1', name: 'f1', type: 'DESCENDENTE', subtype: 'FILHO' },
                { id: 'f2', name: 'f2', type: 'DESCENDENTE', subtype: 'FILHO' },
                { id: 'f3', name: 'f3', type: 'DESCENDENTE', subtype: 'FILHO' },
            ],
            assets: [{ id: 'b0', description: 'b0', type: 'FINANCEIRO', origin: 'PARTICULAR', marketValue: 1599.61, assignments: [] }],
            liabilities: [{ id: 'd', description: 'd', value: 30538, origin: 'COMUM', partitionTreatment: 'HERDEIRO_TORNA', responsibleHeirId: 'f0' }],
            settings: { applyInventoryDiscount: false, selectedState: 'RS', donationState: 'SP', assetValuationBasis: 'MARKET' },
        });
        expect(r.targets.map(t => [t.personId, t.percentageOfEstate, t.fracaoDoMonte?.texto])).toEqual([
            ['conj', 25, '1/4'],
            ['f0', 18.75, '3/16'],
            ['f1', 18.75, '3/16'],
            ['f2', 18.75, '3/16'],
            ['f3', 18.75, '3/16'],
        ]);
    });
});
