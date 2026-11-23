import { describe, expect, it } from 'vitest';
import { calculatePartition } from '../services/partilha/motor';
import { resolveAssetItcdCompetence } from '../services/partilha/competencia';
import { bem, caso, conta, filho } from './caracterizacao/cenarios';

// Segunda revisão: os dois pontos que tinham ficado para decisão.

const uf = (r: ReturnType<typeof calculatePartition>, estado: string) => r.itcdBreakdown.find(i => i.state === estado);
const guias = (r: ReturnType<typeof calculatePartition>, estado: string) =>
    (uf(r, estado)?.beneficiarios || []).map(b => [b.personId, b.base, b.taxAmount]);
const alvo = (r: ReturnType<typeof calculatePartition>, id: string) => r.targets.find(t => t.personId === id)!;
const conjuge = { id: 'conj', name: 'Cônjuge', type: 'CONJUGE' };
const legatario = { id: 't1', name: 't1', type: 'TESTAMENTARIO', testamentaryMode: 'SPECIFIC_ASSETS' };

describe('1. legado de bem comum vale só sobre a parte do testador (CC, art. 1.914)', () => {
    // Comunhão parcial: imóvel COMUM de 600 mil legado por inteiro a terceiro; particular de 400 mil;
    // cônjuge e 1 filho. A meação do cônjuge (300 mil) inclui a metade do imóvel legado.
    const casoComum = (regime = 'COMUNHAO_PARCIAL') =>
        caso({
            deceased: { hasWill: true, maritalRegime: regime, spouseName: 'Cônjuge' },
            heirs: [conjuge, filho('f1'), legatario],
            assets: [
                bem('comum', 600_000, { origin: 'COMUM', assignments: [{ personId: 't1', percentage: 100, value: 600_000, lockReason: 'TESTAMENT' }] }),
                bem('particular', 400_000),
            ],
        });

    it('o legado de 600 mil vale 300 mil (a metade do falecido) e cabe na disponível — sem inoficiosidade', () => {
        const r = calculatePartition(casoComum());
        expect(alvo(r, 't1').testamentaryValue).toBe(300_000);
        expect(r.testamentaryTotal).toBe(300_000);
        expect(r.isTestamentaryExcessive).toBe(false);
        expect(r.avisos.some(a => a.codigo === 'DISPOSICAO_INOFICIOSA')).toBe(false);
    });

    it('a meação do cônjuge sobre o bem fica com o cônjuge, e o legado sai da massa comum', () => {
        const r = calculatePartition(casoComum());
        expect(alvo(r, 'conj').meacaoValue).toBe(300_000);
        // O legado consumiu a herança comum; sobra o particular, em que o cônjuge concorre (art. 1.829, I).
        expect(alvo(r, 'conj').inheritanceValue).toBe(200_000);
        expect(alvo(r, 'f1').inheritanceValue).toBe(200_000);
        expect(guias(r, 'SP')).toEqual([['conj', 200_000, 8_000], ['f1', 200_000, 8_000], ['t1', 300_000, 12_000]]);
    });

    it('aviso estruturado com o art. 1.914 e o valor do legado antes e depois', () => {
        const r = calculatePartition(casoComum());
        const aviso = r.avisos.find(a => a.codigo === 'LEGADO_LIMITADO_A_PARTE_DO_TESTADOR')!;
        expect(aviso).toEqual(
            expect.objectContaining({ categoria: 'LEGITIMA', gravidade: 'ATENCAO', bens: ['comum'], pessoas: ['t1'], valores: { antes: 600_000, depois: 300_000 } })
        );
        expect(aviso.fundamento).toContain('1.914');
    });

    it('vale igual na comunhão universal', () => {
        const r = calculatePartition(casoComum('COMUNHAO_UNIVERSAL'));
        expect(alvo(r, 't1').testamentaryValue).toBe(300_000);
    });

    it('sem cônjuge não há meação: o legado do bem inteiro vale inteiro e não há aviso', () => {
        const r = calculatePartition(
            caso({
                deceased: { hasWill: true },
                heirs: [filho('f1'), legatario],
                assets: [bem('b', 400_000, { assignments: [{ personId: 't1', percentage: 100, value: 400_000, lockReason: 'TESTAMENT' }] }), bem('o', 600_000)],
            })
        );
        expect(alvo(r, 't1').testamentaryValue).toBe(400_000);
        expect(r.avisos.some(a => a.codigo === 'LEGADO_LIMITADO_A_PARTE_DO_TESTADOR')).toBe(false);
    });

    it('legado de metade ideal do bem comum já está dentro da parte do testador: não é reduzido', () => {
        const r = calculatePartition({
            ...casoComum(),
            assets: [
                bem('comum', 600_000, { origin: 'COMUM', assignments: [{ personId: 't1', percentage: 50, value: 300_000, lockReason: 'TESTAMENT' }] }),
                bem('particular', 400_000),
            ],
        });
        expect(alvo(r, 't1').testamentaryValue).toBe(300_000);
        expect(r.avisos.some(a => a.codigo === 'LEGADO_LIMITADO_A_PARTE_DO_TESTADOR')).toBe(false);
    });
});

describe('2. de cujus no exterior: ITCD apurado por sucessor (LC 227/2026, arts. 158, III, e 159, II)', () => {
    const exterior = (heirs: any[], extra: Record<string, unknown> = {}) =>
        caso({ deceased: { domiciledAbroad: true, lastResidenceState: undefined, ...extra }, heirs, assets: [conta('c', 1_000_000)] });

    it('sucessores no RS e em MG: cada quinhão é tributado na UF do próprio sucessor', () => {
        const r = calculatePartition(exterior([filho('f1', { residenceState: 'RS' }), filho('f2', { residenceState: 'MG' })], { successorDomicileState: 'SP' }));
        // RS: 500 mil = 17.651 UPF-RS → 4%; MG: 5%.
        expect(guias(r, 'RS')).toEqual([['f1', 500_000, 20_000]]);
        expect(guias(r, 'MG')).toEqual([['f2', 500_000, 25_000]]);
        expect(uf(r, 'SP')).toBeUndefined();
        expect(r.taxAmount).toBe(45_000);
        expect(uf(r, 'RS')!.competenceRules.map(c => c.rule)).toEqual(['MOVEL_EXT_DOMICILIO_SUCESSOR']);
        expect(uf(r, 'RS')!.competenciaIndeterminada).toBe(false);
    });

    it('não trava a minuta quando todos os sucessores têm UF, e informa a apuração por sucessor', () => {
        const r = calculatePartition(exterior([filho('f1', { residenceState: 'RS' }), filho('f2', { residenceState: 'MG' })]));
        expect(r.avisos.some(a => a.codigo === 'COMPETENCIA_INDETERMINADA')).toBe(false);
        expect(r.minuta.motivos.filter(m => m.categoria === 'COMPETENCIA')).toEqual([]);
        const info = r.avisos.find(a => a.codigo === 'COMPETENCIA_POR_SUCESSOR')!;
        expect(info).toEqual(expect.objectContaining({ gravidade: 'INFORMATIVO', ufs: ['MG', 'RS'] }));
    });

    it('herdeiro sem UF informada: a parte DELE fica indeterminada, com aviso e trava; a do outro, não', () => {
        const r = calculatePartition(exterior([filho('f1', { residenceState: 'RS' }), filho('f2')], { successorDomicileState: 'RS' }));
        // A parte de f2 não vai para o RS de f1 como se fosse dele: é estimada e marcada.
        expect(guias(r, 'RS')).toEqual([['f1', 500_000, 20_000], ['f2', 500_000, 20_000]]);
        expect(uf(r, 'RS')!.competenciaIndeterminada).toBe(true);
        const aviso = r.avisos.find(a => a.codigo === 'COMPETENCIA_INDETERMINADA')!;
        expect(aviso).toEqual(expect.objectContaining({ gravidade: 'EXIGE_CONFIRMACAO', pessoas: ['f2'], bens: ['c'] }));
        expect(r.minuta.exigeConfirmacao).toBe(true);
    });

    it('sem UF de nenhum sucessor e sem UF informada no falecido: estimativa pela UF do processo, indeterminada', () => {
        const r = calculatePartition(exterior([filho('f1'), filho('f2')]));
        expect(guias(r, 'SP')).toEqual([['f1', 500_000, 20_000], ['f2', 500_000, 20_000]]);
        expect(uf(r, 'SP')!.competenceRules.map(c => c.rule)).toEqual(['SUCESSOR_DOMICILIO_NAO_INFORMADO']);
        expect(r.avisos.find(a => a.codigo === 'COMPETENCIA_INDETERMINADA')?.pessoas).toEqual(['f1', 'f2']);
    });

    it('legatário de bem que segue o domicílio do sucessor paga na UF dele', () => {
        const r = calculatePartition({
            ...exterior([filho('f1', { residenceState: 'RS' }), { ...legatario, residenceState: 'MG' }], { hasWill: true }),
            assets: [
                conta('c', 400_000, { assignments: [{ personId: 't1', percentage: 100, value: 400_000, lockReason: 'TESTAMENT' }] }),
                conta('d', 600_000),
            ],
        });
        expect(guias(r, 'MG')).toEqual([['t1', 400_000, 20_000]]);
        expect(guias(r, 'RS')).toEqual([['f1', 600_000, 24_000]]);
    });

    it('a resolução por bem diz que a apuração é por sucessor', () => {
        const c = resolveAssetItcdCompetence({ type: 'FINANCEIRO' }, { deathDate: '2026-01-01', domiciledAbroad: true }, { selectedState: 'SP' });
        expect(c.porSucessor).toBe(true);
        expect(c.competence.rule).toBe('MOVEL_EXT_DOMICILIO_SUCESSOR');
    });

    it('falecido domiciliado no Brasil: nada muda (domicílio do de cujus, sem apuração por sucessor)', () => {
        const r = calculatePartition(
            caso({ deceased: { lastResidenceState: 'MG' }, heirs: [filho('f1', { residenceState: 'RS' }), filho('f2', { residenceState: 'SP' })], assets: [conta('c', 1_000_000)] })
        );
        expect(r.itcdBreakdown.map(i => i.state)).toEqual(['MG']);
        expect(r.taxAmount).toBe(50_000);
        expect(r.avisos.some(a => a.codigo === 'COMPETENCIA_POR_SUCESSOR')).toBe(false);
    });
});
