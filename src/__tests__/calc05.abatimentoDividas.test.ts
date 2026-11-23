import { describe, expect, it } from 'vitest';
import { calculatePartition } from '../services/partilha/motor';
import { PERFIL_ITCD_UF } from '../services/itcdStrategies/perfilUf';
import { classifyItcdWarning } from '../services/itcdStrategies/warnings';
import { bem, caso, filho } from './caracterizacao/cenarios';

// CALC-05 (Média; Alta em SP): a base do ITCD dependia do "tratamento" escolhido para a dívida
// (ESPOLIO, BEM_VINCULADO, HERDEIRO_TORNA) e não da lei da UF. Em SP a Lei 10.705/2000, art. 12,
// manda NÃO abater dívida nenhuma — o tratamento típico de financiamento subcobrava R$ 12.000.

const doisFilhos = [filho('f1'), filho('f2')];
const divida = (tratamento: string) => {
    const base = { id: 'd1', description: 'Financiamento', value: 300_000, origin: 'PARTICULAR', partitionTreatment: tratamento };
    if (tratamento === 'BEM_VINCULADO') return { ...base, assetLinks: [{ assetId: 'imovel', deductedValue: 300_000 }] };
    if (tratamento === 'HERDEIRO_TORNA') return { ...base, responsibleHeirId: 'f1' };
    return base;
};
const imovelComDivida = (uf: string, tratamento: string) =>
    caso({
        deceased: { lastResidenceState: uf },
        heirs: doisFilhos,
        assets: [bem('imovel', 1_000_000, { state: uf })],
        liabilities: [divida(tratamento)],
        settings: { selectedState: uf },
    });

describe('CALC-05 — SP: dívida não abate a base (Lei 10.705/2000, art. 12)', () => {
    it.each(['ESPOLIO', 'BEM_VINCULADO', 'HERDEIRO_TORNA'])('imóvel 1 mi com dívida de 300 mil (%s), 2 filhos → R$ 40.000', tratamento => {
        const r = calculatePartition(imovelComDivida('SP', tratamento));
        const sp = r.itcdBreakdown.find(i => i.state === 'SP')!;
        expect(sp.taxBase).toBe(1_000_000);
        expect(r.taxAmount).toBe(40_000);
        expect(sp.abateDividas).toBe(false);
    });

    it.each(['ESPOLIO', 'BEM_VINCULADO', 'HERDEIRO_TORNA'])('com a ressalva de que há decisões admitindo o abatimento (%s)', tratamento => {
        const r = calculatePartition(imovelComDivida('SP', tratamento));
        const sp = r.itcdBreakdown.find(i => i.state === 'SP')!;
        expect(classifyItcdWarning(sp.warningMessage)).toContain('BASE_CALCULO');
        const aviso = r.avisos.find(a => a.codigo === 'DIVIDAS_NAO_ABATIDAS')!;
        expect(aviso).toEqual(expect.objectContaining({ categoria: 'BASE_CALCULO', ufs: ['SP'] }));
        expect(aviso.fundamento).toContain('10.705/2000, art. 12');
        expect(aviso.mensagem).toContain('decisões judiciais admitindo o abatimento');
    });
});

describe("CALC-05 — UF sem regra registrada: 'controvertido', comportamento atual e aviso com as duas leituras", () => {
    it('MG, dívida vinculada ao imóvel: segue abatendo (como antes) e mostra o ITCD sem abatimento', () => {
        const r = calculatePartition(imovelComDivida('MG', 'BEM_VINCULADO'));
        const mg = r.itcdBreakdown.find(i => i.state === 'MG')!;
        expect(mg.abateDividas).toBe('controvertido');
        expect(mg.taxBase).toBe(700_000);
        expect(r.taxAmount).toBe(35_000);

        const aviso = r.avisos.find(a => a.codigo === 'ABATIMENTO_DIVIDAS_CONTROVERTIDO')!;
        expect(aviso).toEqual(expect.objectContaining({ categoria: 'BASE_CALCULO', gravidade: 'ATENCAO', ufs: ['MG'] }));
        expect(aviso.valores).toEqual({ itcdAdotado: 35_000, itcdBaseBruta: 50_000, itcdTodasAbatidas: 35_000 });
        expect(classifyItcdWarning(mg.warningMessage)).toContain('BASE_CALCULO');
    });

    it('MG, dívida do espólio: segue sem abater (como antes) e mostra o ITCD com a dívida abatida', () => {
        const r = calculatePartition(imovelComDivida('MG', 'ESPOLIO'));
        expect(r.taxAmount).toBe(50_000);
        expect(r.avisos.find(a => a.codigo === 'ABATIMENTO_DIVIDAS_CONTROVERTIDO')!.valores).toEqual({
            itcdAdotado: 50_000,
            itcdBaseBruta: 50_000,
            itcdTodasAbatidas: 35_000,
        });
    });

    it('sem dívida não há o que avisar sobre abatimento', () => {
        const r = calculatePartition(caso({ deceased: { lastResidenceState: 'MG' }, heirs: doisFilhos, assets: [bem('imovel', 1_000_000, { state: 'MG' })] }));
        // A categoria BASE_CALCULO também cobre o aviso informativo de base por quinhão só pelo
        // CTN (revisão); aqui o que não pode aparecer é aviso de DÍVIDA.
        expect(r.avisos.some(a => a.codigo === 'DIVIDAS_NAO_ABATIDAS' || a.codigo === 'ABATIMENTO_DIVIDAS_CONTROVERTIDO')).toBe(false);
    });
});

describe('CALC-05 — registro por UF', () => {
    it("SP é a única UF com regra registrada (false); as demais são 'controvertido'", () => {
        const regras = Object.entries(PERFIL_ITCD_UF).map(([uf, p]) => [uf, p.abateDividas]);
        expect(regras.filter(([, r]) => r === false)).toEqual([['SP', false]]);
        expect(regras.filter(([, r]) => r === 'controvertido')).toHaveLength(26);
        expect(PERFIL_ITCD_UF.SP.fonteAbateDividas).toContain('art. 12');
    });
});
