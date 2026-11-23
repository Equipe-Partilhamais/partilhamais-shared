import { describe, expect, it } from 'vitest';
import { calculateItcdForState } from '../services/itcdStrategies';
import { classifyItcdWarning } from '../services/itcdStrategies/warnings';
import { PERFIL_ITCD_UF } from '../services/itcdStrategies/perfilUf';
import { UF } from '../types';

// CALC-10 (Baixa): na doação, todas as 27 UFs diziam "valor calculado com a regra de causa
// mortis" — inclusive as que TÊM tabela própria de doação (AL, BA, MG, PB, RS), onde a frase é
// falsa. O aviso só cabe quando a UF não tem tabela de doação registrada.

const doacao = (uf: UF) => calculateItcdForState(uf, 1_000_000, { applyInventoryDiscount: false }, '2026-01-01', 'DOACAO');
const TODAS = Object.keys(PERFIL_ITCD_UF) as UF[];
const COM_TABELA_PROPRIA: UF[] = ['AL', 'BA', 'MG', 'PB', 'RS'];

describe('CALC-10 — aviso de "regra de causa mortis" só onde não há tabela de doação', () => {
    it('as UFs com tabela própria de doação são as que ramificam por tipo de fato gerador', () => {
        expect(TODAS.filter(uf => PERFIL_ITCD_UF[uf].tabelaDoacao === 'PROPRIA').sort()).toEqual(COM_TABELA_PROPRIA);
    });

    it.each(COM_TABELA_PROPRIA)('%s: não diz que usou a regra de causa mortis, e segue como tabela não homologada', uf => {
        const r = doacao(uf);
        expect(r.warningMessage).not.toContain('regra de causa mortis');
        expect(r.confiabilidade).toBe('NAO_CONFIGURADA');
        expect(classifyItcdWarning(r.warningMessage)).toContain('TABELA_NAO_HOMOLOGADA');
    });

    it.each(TODAS.filter(uf => PERFIL_ITCD_UF[uf].tabelaDoacao === 'NAO_REGISTRADA'))('%s: sem tabela de doação, avisa que usou a regra de causa mortis', uf => {
        expect(doacao(uf).warningMessage).toContain('valor calculado com a regra de causa mortis');
    });

    it('GO: a lei registrada aplica à doação a mesma tabela — o aviso diz isso, e não que faltou tabela', () => {
        const r = doacao('GO');
        expect(r.warningMessage).toContain('mesma tabela da causa mortis');
        expect(r.warningMessage).not.toContain('valor calculado com a regra de causa mortis');
        expect(classifyItcdWarning(r.warningMessage)).toContain('TABELA_NAO_HOMOLOGADA');
    });
});
