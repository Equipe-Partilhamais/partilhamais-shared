import { describe, expect, it } from 'vitest';
import { calculatePartition } from '../services/partilha/motor';
import { calculateItcdForState } from '../services/itcdStrategies';
import { bem, caso, conta, filho } from './caracterizacao/cenarios';

// Avisos e travas pedidos na revisão, e os dois testes que faltavam (mutações que sobreviveram).

const codigos = (r: ReturnType<typeof calculatePartition>) => r.avisos.map(a => `${a.codigo}/${a.gravidade}`);
const doisFilhos = [filho('f1'), filho('f2')];

describe('mutações que sobreviveram', () => {
    it('imóvel no exterior com o domicílio do falecido vazio: IMOVEL_EXT_DOMICILIO_NAO_INFORMADO, indeterminado e trava', () => {
        const r = calculatePartition(
            caso({ deceased: { lastResidenceState: undefined }, heirs: doisFilhos, assets: [bem('ext', 700_000, { state: undefined, location: 'EXTERIOR' })] })
        );
        const item = r.itcdBreakdown[0];
        expect(item.competenceRules.map(c => c.rule)).toEqual(['IMOVEL_EXT_DOMICILIO_NAO_INFORMADO']);
        expect(item.competenciaIndeterminada).toBe(true);
        expect(r.avisos).toEqual(expect.arrayContaining([expect.objectContaining({ codigo: 'COMPETENCIA_INDETERMINADA', bens: ['ext'] })]));
    });

    it('doação por excesso com domicílio do doador vazio: aviso COMPETENCIA_DOACAO_ESTIMADA, que trava a minuta', () => {
        const r = calculatePartition(
            caso({
                heirs: [filho('c1', { residenceState: 'MG' }), filho('c2')],
                assets: [conta('conta', 200_000, { assignments: [{ personId: 'c1', percentage: 100 }] })],
            })
        );
        const aviso = r.avisos.find(a => a.codigo === 'COMPETENCIA_DOACAO_ESTIMADA')!;
        expect(aviso).toEqual(expect.objectContaining({ categoria: 'COMPETENCIA', gravidade: 'EXIGE_CONFIRMACAO', ufs: ['SP'] }));
        expect(aviso.pessoas).toEqual(expect.arrayContaining(['c1', 'c2']));
        expect(r.minuta.motivos.map(m => m.codigo)).toContain('COMPETENCIA_DOACAO_ESTIMADA');
    });
});

describe('travas novas', () => {
    it('faixas estimadas (DF) exigem confirmação na minuta', () => {
        const r = calculatePartition(caso({ heirs: doisFilhos, assets: [bem('i', 2_000_000, { state: 'DF' })] }));
        expect(codigos(r)).toContain('TABELA_FAIXAS_ESTIMADAS/EXIGE_CONFIRMACAO');
        expect(r.minuta.exigeConfirmacao).toBe(true);
    });

    it('unidade fiscal fora da vigência (RS, óbito em 2022, UPF de 2025): aviso estruturado e trava', () => {
        const r = calculatePartition(
            caso({ deceased: { deathDate: '2022-03-01' }, heirs: [filho('f1'), filho('f2'), filho('f3')], assets: [bem('i', 1_000_000, { state: 'RS' })] })
        );
        const aviso = r.avisos.find(a => a.codigo === 'INDICE_FISCAL_FORA_DA_VIGENCIA')!;
        expect(aviso).toEqual(expect.objectContaining({ categoria: 'INDICE_FISCAL', gravidade: 'EXIGE_CONFIRMACAO', ufs: ['RS'] }));
        expect(r.minuta.exigeConfirmacao).toBe(true);
    });

    it('herança insolvente (passivo do espólio ≥ monte): aviso e trava, citando o art. 1.792', () => {
        const r = calculatePartition(
            caso({
                heirs: [filho('f1')],
                assets: [bem('i', 300_000)],
                liabilities: [{ id: 'd', description: 'd', value: 500_000, origin: 'PARTICULAR', partitionTreatment: 'ESPOLIO' }],
            })
        );
        const aviso = r.avisos.find(a => a.codigo === 'HERANCA_INSOLVENTE')!;
        expect(aviso.gravidade).toBe('EXIGE_CONFIRMACAO');
        expect(aviso.mensagem).toContain('1.792');
        expect(r.minuta.exigeConfirmacao).toBe(true);
    });

    // Revisão 2: a competência por sucessor deixou de ser só aviso + trava (SUCESSORES_EM_UFS_DIFERENTES,
    // removido) e passou a ser apurada — ver revisao2.legadoESucessores.test.ts. Aqui fica o aviso
    // informativo que diz para que UF foi a parte de cada sucessor.
    it('de cujus no exterior com sucessores em UFs diferentes: apuração por sucessor, aviso informativo citando o art. 159, II', () => {
        const r = calculatePartition(
            caso({
                deceased: { domiciledAbroad: true, lastResidenceState: undefined, successorDomicileState: 'SP' },
                heirs: [filho('f1', { residenceState: 'RS' }), filho('f2', { residenceState: 'MG' })],
                assets: [conta('c', 1_000_000)],
            })
        );
        const aviso = r.avisos.find(a => a.codigo === 'COMPETENCIA_POR_SUCESSOR')!;
        expect(aviso).toEqual(expect.objectContaining({ categoria: 'COMPETENCIA', gravidade: 'INFORMATIVO', ufs: ['MG', 'RS'] }));
        expect(aviso.mensagem).toContain('159, II');
        expect(r.itcdBreakdown.map(i => i.state)).toEqual(['MG', 'RS']);
    });

    it('sucessores todos em SP: tudo em SP, sem trava de competência', () => {
        const r = calculatePartition(
            caso({
                deceased: { domiciledAbroad: true, lastResidenceState: undefined, successorDomicileState: 'SP' },
                heirs: [filho('f1', { residenceState: 'SP' }), filho('f2', { residenceState: 'SP' })],
                assets: [conta('c', 1_000_000)],
            })
        );
        expect(r.itcdBreakdown.map(i => [i.state, i.competenciaIndeterminada])).toEqual([['SP', false]]);
        expect(r.minuta.motivos.some(m => m.categoria === 'COMPETENCIA')).toBe(false);
    });
});

describe('avisos informativos e texto de doação', () => {
    it('base por quinhão adotada só com o CTN: aviso INFORMATIVO com as UFs sem fonte própria', () => {
        const r = calculatePartition(
            caso({ heirs: doisFilhos, assets: [bem('rj', 1_000_000, { state: 'RJ' }), bem('rs', 1_000_000, { state: 'RS' })] })
        );
        const aviso = r.avisos.find(a => a.codigo === 'BASE_QUINHAO_SO_PELO_CTN')!;
        expect(aviso.gravidade).toBe('INFORMATIVO');
        expect(aviso.ufs).toEqual(['RJ']); // o RS tem fonte própria (art. 18, § 1º)
    });

    it('com um herdeiro só não há o que avisar sobre base por quinhão', () => {
        const r = calculatePartition(caso({ heirs: [filho('f1')], assets: [bem('rj', 1_000_000, { state: 'RJ' })] }));
        expect(r.avisos.some(a => a.codigo === 'BASE_QUINHAO_SO_PELO_CTN')).toBe(false);
    });

    it('SP: a doação não diz mais "regra de causa mortis" (SP.ts: os 4% valem para os dois)', () => {
        const aviso = calculateItcdForState('SP', 300_000, { applyInventoryDiscount: false }, '2026-01-01', 'DOACAO').warningMessage;
        expect(aviso).not.toContain('regra de causa mortis');
        expect(aviso).toContain('mesma tabela da causa mortis');
    });
});
