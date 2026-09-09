import { describe, expect, it } from 'vitest';
import {
    calculateItcdForState,
    getConferencia,
    ITCD_HOMOLOGACAO,
    isHomologada,
    listUfsNaoConfiguradas,
} from '../services/itcdStrategies';
import { UF } from '../types';

const OBITO = '2025-06-15';
const SETTINGS = { applyInventoryDiscount: false };

const TODAS_AS_UFS = Object.keys(ITCD_HOMOLOGACAO) as UF[];

describe('conferência das tabelas de ITCD', () => {
    // A regressão que este bloco impede: marcar UF como homologada porque o código já citava
    // uma lei. A norma citada é rastreabilidade; homologação exige assinatura de quem conferiu.
    it('nenhuma UF está homologada enquanto ninguém assinar a conferência', () => {
        expect(listUfsNaoConfiguradas('CAUSA_MORTIS').sort()).toEqual([...TODAS_AS_UFS].sort());
        expect(listUfsNaoConfiguradas('DOACAO').sort()).toEqual([...TODAS_AS_UFS].sort());

        TODAS_AS_UFS.forEach(uf => {
            expect(getConferencia(uf, 'CAUSA_MORTIS')).toBeUndefined();
            expect(getConferencia(uf, 'DOACAO')).toBeUndefined();
        });
    });

    it('norma citada no código não homologa: só a conferência assinada homologa', () => {
        const comNormaCitada = TODAS_AS_UFS.filter(uf => !!ITCD_HOMOLOGACAO[uf].normaCitadaNoCodigo);

        expect(comNormaCitada.length).toBeGreaterThan(0);
        comNormaCitada.forEach(uf => expect(isHomologada(uf, 'CAUSA_MORTIS')).toBe(false));

        // O registro precisa continuar aceitando a citação quando o parecer chegar.
        const registro = {
            ...ITCD_HOMOLOGACAO.SP,
            causaMortis: { conferidaPor: 'Fulano', conferidaEm: '2026-01-02', referencia: 'Norma X, art. Y' },
        };
        expect(registro.causaMortis.conferidaPor).toBe('Fulano');
    });

    it.each(TODAS_AS_UFS)('%s carimba confiabilidade, pendência e aviso no resultado', (uf) => {
        const resultado = calculateItcdForState(uf, 1_000_000, SETTINGS, OBITO, 'CAUSA_MORTIS');

        expect(resultado.confiabilidade).toBe('NAO_CONFIGURADA');
        expect(resultado.pendenciaHomologacao).toBeTruthy();
        expect(resultado.warningMessage).toContain(`SEFAZ/${uf}`);
    });

    // O texto de placeholder era impresso no DOCX entregue ao cliente.
    it.each(TODAS_AS_UFS)('%s não publica texto de rascunho no legalText', (uf) => {
        const { legalText } = calculateItcdForState(uf, 1_000_000, SETTINGS, OBITO, 'CAUSA_MORTIS');

        expect(legalText).toBeTruthy();
        expect(legalText.toLowerCase()).not.toContain('aguardando configuração real');
        expect(legalText.toLowerCase()).not.toContain('estimad');
        expect(legalText.toLowerCase()).not.toContain('exemplo fornecido');
        expect(legalText.toLowerCase()).not.toContain('da imagem');
    });

    it('UF fora do registro cai na regra padrão e nunca sai como homologada', () => {
        const resultado = calculateItcdForState('XX' as UF, 1_000_000, SETTINGS, OBITO, 'CAUSA_MORTIS');

        expect(resultado.taxAmount).toBeCloseTo(40_000, 2);
        expect(resultado.confiabilidade).toBe('NAO_CONFIGURADA');
        expect(resultado.pendenciaHomologacao).toContain('regra padrão nacional');
    });
});

describe('ITCD de doação (excesso de partilha)', () => {
    it.each(TODAS_AS_UFS)('%s avisa que a doação foi calculada com a regra de causa mortis', (uf) => {
        const doacao = calculateItcdForState(uf, 1_000_000, SETTINGS, OBITO, 'DOACAO');

        expect(doacao.confiabilidade).toBe('NAO_CONFIGURADA');
        expect(doacao.warningMessage).toContain('Alíquota de doação não homologada');
    });

    it('RS aplica a tabela de doação, distinta da de causa mortis', () => {
        const causaMortis = calculateItcdForState('RS', 1_000_000, SETTINGS, OBITO, 'CAUSA_MORTIS');
        const doacao = calculateItcdForState('RS', 1_000_000, SETTINGS, OBITO, 'DOACAO');

        // Doação: 10.000 UPF x 3% + 26.710,7195 UPF x 4% = 1.368,4288 UPF -> x 27,24
        expect(doacao.taxAmount).toBeCloseTo(37_276.0, 1);
        expect(doacao.taxAmount).not.toBeCloseTo(causaMortis.taxAmount, 2);
    });

    it('MG aplica a regra de doação (5% com desconto do art. 23-A)', () => {
        const doacao = calculateItcdForState('MG', 100_000, SETTINGS, OBITO, 'DOACAO');

        expect(doacao.taxAmount).toBeCloseTo(2_500, 2);
        expect(doacao.discountApplied).toContain('23-A');
    });

    it('SP cobra 4% nos dois fatos geradores, e a norma citada fica registrada', () => {
        const causaMortis = calculateItcdForState('SP', 1_000_000, SETTINGS, OBITO, 'CAUSA_MORTIS');
        const doacao = calculateItcdForState('SP', 1_000_000, SETTINGS, OBITO, 'DOACAO');

        expect(doacao.taxAmount).toBeCloseTo(causaMortis.taxAmount, 2);
        expect(ITCD_HOMOLOGACAO.SP.normaCitadaNoCodigo).toContain('10.705');
    });
});
