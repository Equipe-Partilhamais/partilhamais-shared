import { describe, expect, it } from 'vitest';
import { calculatePartition } from '../services/partilha/motor';
import { resolveAssetItcdCompetence } from '../services/partilha/competencia';
import { classifyItcdWarning } from '../services/itcdStrategies/warnings';
import { bem, caso, conta, filho } from './caracterizacao/cenarios';

// CALC-03 (Alta): com o domicílio do falecido vazio e óbito a partir de 20/12/2023, o bem
// móvel era tributado na UF do PROCESSO com o rótulo "Móvel/crédito — domicílio do de cujus"
// e nenhum aviso. Desde a EC 132/2023 a competência dos móveis é do domicílio do de cujus
// (CF, art. 155, § 1º, II); sem ele, ela é indeterminada — e isso tem de aparecer.

const casoDoCartao = caso({ deceased: { lastResidenceState: undefined }, heirs: [filho('f1')], assets: [conta('conta', 1_000_000)] });

describe('CALC-03 — domicílio do falecido vazio, óbito a partir de 20/12/2023', () => {
    it('não rotula a regra do domicílio do de cujus, que não foi aplicada', () => {
        const r = calculatePartition(casoDoCartao);
        const sp = r.itcdBreakdown.find(i => i.state === 'SP')!;
        const regras = sp.competenceRules.map(c => c.rule);

        expect(regras).not.toContain('MOVEL_DOMICILIO_DE_CUJUS');
        expect(regras).toEqual(['MOVEL_DOMICILIO_NAO_INFORMADO']);
        expect(sp.competenceRules[0].label).toMatch(/NÃO informado/);
    });

    it('marca a competência como indeterminada e diz que a UF do processo é só estimativa', () => {
        const r = calculatePartition(casoDoCartao);
        const sp = r.itcdBreakdown.find(i => i.state === 'SP')!;

        expect(sp.competenciaIndeterminada).toBe(true);
        expect(classifyItcdWarning(sp.warningMessage)).toContain('COMPETENCIA');
        expect(sp.warningMessage).toContain('competência estimada pela UF do processo (SP)');
    });

    it('produz aviso estruturado de COMPETENCIA, com o bem e a UF, que exige confirmação na minuta', () => {
        const r = calculatePartition(casoDoCartao);
        const aviso = r.avisos.find(a => a.codigo === 'COMPETENCIA_INDETERMINADA');

        expect(aviso).toEqual(
            expect.objectContaining({ categoria: 'COMPETENCIA', gravidade: 'EXIGE_CONFIRMACAO', ufs: ['SP'], bens: ['conta'] })
        );
        expect(r.minuta.exigeConfirmacao).toBe(true);
        expect(r.minuta.motivos.map(m => m.codigo)).toContain('COMPETENCIA_INDETERMINADA');
    });

    it('com o domicílio em MG: regra aplicada, sem aviso, R$ 50.000 em MG (controle do cartão)', () => {
        const r = calculatePartition(caso({ deceased: { lastResidenceState: 'MG' }, heirs: [filho('f1')], assets: [conta('conta', 1_000_000)] }));
        expect(r.itcdBreakdown.map(i => [i.state, i.taxAmount, i.competenciaIndeterminada])).toEqual([['MG', 50_000, false]]);
        expect(r.itcdBreakdown[0].competenceRules.map(c => c.rule)).toEqual(['MOVEL_DOMICILIO_DE_CUJUS']);
        expect(r.avisos.some(a => a.categoria === 'COMPETENCIA')).toBe(false);
    });

    it('óbito antes de 20/12/2023 segue a UF do processo pela regra histórica, sem aviso', () => {
        const r = calculatePartition(
            caso({ deceased: { deathDate: '2023-06-01', lastResidenceState: undefined }, heirs: [filho('f1')], assets: [conta('conta', 1_000_000)] })
        );
        expect(r.itcdBreakdown[0].competenceRules.map(c => c.rule)).toEqual(['MOVEL_INVENTARIO_PROCESSO']);
        expect(r.itcdBreakdown[0].competenciaIndeterminada).toBe(false);
        expect(r.avisos.some(a => a.codigo === 'COMPETENCIA_INDETERMINADA')).toBe(false);
    });

    it('imóvel sem UF de situação também não leva o rótulo de "situação do bem"', () => {
        const r = calculatePartition(caso({ heirs: [filho('f1')], assets: [bem('imovel', 500_000, { state: undefined })] }));
        expect(r.itcdBreakdown[0].competenceRules.map(c => c.rule)).toEqual(['IMOVEL_UF_NAO_INFORMADA']);
        expect(r.avisos.find(a => a.codigo === 'COMPETENCIA_INDETERMINADA')?.bens).toEqual(['imovel']);
    });

    it('resolveAssetItcdCompetence expõe a indeterminação para a tela', () => {
        const c = resolveAssetItcdCompetence(
            { type: 'FINANCEIRO' },
            { deathDate: '2026-01-01', lastResidenceState: undefined },
            { selectedState: 'SP' }
        );
        expect(c.indeterminada).toBe(true);
        expect(c.state).toBe('SP');
        expect(c.competence.rule).toBe('MOVEL_DOMICILIO_NAO_INFORMADO');
    });

    it('a doação por excesso de quinhão com doador sem domicílio informado avisa a estimativa', () => {
        const r = calculatePartition(
            caso({
                heirs: [filho('c1', { residenceState: 'MG' }), filho('c2')],
                assets: [conta('conta', 200_000, { assignments: [{ personId: 'c1', percentage: 100, value: 200_000 }] })],
            })
        );
        expect(r.donationBreakdown[0].warningMessage).toContain('competência estimada');
        expect(classifyItcdWarning(r.donationBreakdown[0].warningMessage)).toContain('COMPETENCIA');
    });
});
