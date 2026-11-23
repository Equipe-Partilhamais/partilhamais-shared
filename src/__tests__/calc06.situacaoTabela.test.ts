import { describe, expect, it } from 'vitest';
import { calculateItcdForState } from '../services/itcdStrategies';
import { classifyItcdWarning } from '../services/itcdStrategies/warnings';
import { PERFIL_ITCD_UF, SituacaoTabelaItcd } from '../services/itcdStrategies/perfilUf';
import { calculatePartition } from '../services/partilha/motor';
import { UF } from '../types';
import { bem, caso, conta, filho } from './caracterizacao/cenarios';

// CALC-06 (Alta): o sistema exibia fundamento legal FALSO ("Legislação Estadual SE. Alíquota
// única de 8%."; RN "Alíquota única de 3%") e a MESMA ressalva para as 27 UFs — RS, pesquisada
// em fonte primária, e SE, sabidamente errada, saíam com o mesmo texto. O advogado não tinha
// como distinguir uma da outra: um erro visível trocado por um invisível.

const SETTINGS = { applyInventoryDiscount: false };
const OBITO = '2026-01-01';
const itcd = (uf: UF) => calculateItcdForState(uf, 1_000_000, SETTINGS, OBITO, 'CAUSA_MORTIS');

describe('CALC-06 — situação de cada tabela, derivada do que o repositório registra', () => {
    it.each<[SituacaoTabelaItcd, UF[]]>([
        // Comentário de divergência no arquivo da UF, mensagem do commit 0499321 ou auditoria (RN).
        ['DIVERGENCIA_CONHECIDA', ['AC', 'PA', 'RN', 'SE', 'TO']],
        // Arquivo da UF registra norma, artigo, data e endereço da consulta.
        ['PESQUISADA', ['AL', 'BA', 'GO', 'PB', 'RS']],
        // Faixas declaradas estimadas ou sem norma citada.
        ['FAIXAS_ESTIMADAS', ['AM', 'AP', 'DF', 'RO']],
    ])('%s: %j', (situacao, ufs) => {
        const obtidas = (Object.keys(PERFIL_ITCD_UF) as UF[]).filter(uf => PERFIL_ITCD_UF[uf].situacaoTabela === situacao).sort();
        expect(obtidas).toEqual(ufs);
    });

    it('as demais 13 UFs são de REFERÊNCIA, e toda situação diz de onde saiu', () => {
        const referencia = (Object.keys(PERFIL_ITCD_UF) as UF[]).filter(uf => PERFIL_ITCD_UF[uf].situacaoTabela === 'REFERENCIA');
        expect(referencia).toHaveLength(13);
        Object.values(PERFIL_ITCD_UF).forEach(p => expect(p.fonteSituacao.length).toBeGreaterThan(10));
    });

    it('o resultado do ITCD carrega a situação', () => {
        expect(itcd('SE').situacaoTabela).toBe('DIVERGENCIA_CONHECIDA');
        expect(itcd('RS').situacaoTabela).toBe('PESQUISADA');
        expect(itcd('AM').situacaoTabela).toBe('FAIXAS_ESTIMADAS');
        expect(itcd('SP').situacaoTabela).toBe('REFERENCIA');
    });
});

describe('CALC-06 — SE e RN não exibem mais "alíquota única"', () => {
    it.each<UF>(['SE', 'RN'])('%s: texto legal sem "alíquota única" e aviso de divergência conhecida', uf => {
        const r = itcd(uf);
        expect(r.legalText.toLowerCase()).not.toContain('alíquota única de');
        expect(r.legalText).toContain('ivergência conhecida');
        expect(r.warningMessage).toContain('DIVERGÊNCIA CONHECIDA');
        expect(r.pendenciaHomologacao).toContain('diverge');
    });

    it('as alíquotas não mudaram (só o texto): SE 8%, RN 3%, TO e AM como estavam', () => {
        expect(itcd('SE').taxAmount).toBeCloseTo(80_000, 2);
        expect(itcd('RN').taxAmount).toBeCloseTo(30_000, 2);
        expect(itcd('TO').taxAmount).toBeCloseTo(80_000, 2);
        expect(itcd('AM').taxAmount).toBeCloseTo(40_000, 2);
    });

    it('TO e AM: texto legal sem norma inventada e situação própria no aviso', () => {
        expect(itcd('TO').legalText).not.toMatch(/Lei (Estadual )?n?º?\s*\d/);
        expect(itcd('AM').legalText).not.toMatch(/Lei (Estadual )?n?º?\s*\d/);
        expect(itcd('TO').warningMessage).toContain('DIVERGÊNCIA CONHECIDA');
        expect(itcd('AM').warningMessage).toContain('sem fonte legal registrada');
    });
});

describe('CALC-06 — aviso específico por situação (não mais o mesmo para as 27 UFs)', () => {
    it('RS (pesquisada) e SE (divergente) saem com ressalvas diferentes, ambas de tabela não homologada', () => {
        const rs = itcd('RS');
        const se = itcd('SE');
        expect(rs.warningMessage).toContain('pesquisadas na lei estadual');
        expect(rs.warningMessage).not.toContain('DIVERGÊNCIA');
        expect(classifyItcdWarning(rs.warningMessage)).toContain('TABELA_NAO_HOMOLOGADA');
        expect(classifyItcdWarning(se.warningMessage)).toContain('TABELA_NAO_HOMOLOGADA');
        expect(rs.pendenciaHomologacao).not.toEqual(se.pendenciaHomologacao);
    });

    it('as quatro situações produzem quatro textos distintos', () => {
        const textos = new Set((['SE', 'RS', 'AM', 'SP'] as UF[]).map(uf => itcd(uf).warningMessage!.replace(new RegExp(uf, 'g'), 'UF')));
        expect(textos.size).toBe(4);
    });
});

describe('CALC-06 — no resultado da partilha (tela e DOCX) e na minuta', () => {
    it('UF com divergência conhecida: aviso estruturado e a minuta exige confirmação explícita', () => {
        const r = calculatePartition(caso({ heirs: [filho('f1'), filho('f2')], assets: [bem('imovel', 1_000_000, { state: 'SE' })] }));
        const se = r.itcdBreakdown.find(i => i.state === 'SE')!;
        expect(se.situacaoTabela).toBe('DIVERGENCIA_CONHECIDA');

        const aviso = r.avisos.find(a => a.codigo === 'TABELA_DIVERGENCIA_CONHECIDA')!;
        expect(aviso).toEqual(expect.objectContaining({ categoria: 'TABELA_NAO_HOMOLOGADA', gravidade: 'EXIGE_CONFIRMACAO', ufs: ['SE'] }));
        expect(r.minuta.exigeConfirmacao).toBe(true);
        expect(r.minuta.motivos.map(m => m.codigo)).toContain('TABELA_DIVERGENCIA_CONHECIDA');
    });

    it('UF de referência: aviso específico, sem travar a minuta', () => {
        const r = calculatePartition(caso({ heirs: [filho('f1')], assets: [bem('imovel', 1_000_000)] }));
        expect(r.itcdBreakdown[0].situacaoTabela).toBe('REFERENCIA');
        expect(r.avisos).toEqual(expect.arrayContaining([expect.objectContaining({ codigo: 'TABELA_REFERENCIA', gravidade: 'ATENCAO', ufs: ['SP'] })]));
        expect(r.minuta.exigeConfirmacao).toBe(false);
    });

    it('a doação por excesso de quinhão em UF divergente também trava a minuta', () => {
        const r = calculatePartition(
            caso({
                deceased: { lastResidenceState: 'MG' },
                heirs: [filho('c1', { residenceState: 'MG' }), filho('c2', { residenceState: 'SE' })],
                assets: [conta('conta', 200_000, { assignments: [{ personId: 'c1', percentage: 100, value: 200_000 }] })],
            })
        );
        const evento = r.donationBreakdown.find(e => e.donorState === 'SE')!;
        expect(evento.situacaoTabela).toBe('DIVERGENCIA_CONHECIDA');
        expect(r.minuta.motivos.find(m => m.codigo === 'TABELA_DIVERGENCIA_CONHECIDA')?.ufs).toEqual(['SE']);
    });
});
