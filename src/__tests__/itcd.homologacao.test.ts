import { describe, expect, it } from 'vitest';
import {
    calculateItcdForState,
    calculateItcdForStateStrict,
    ITCD_HOMOLOGACAO,
    ItcdUfNaoConfiguradaError,
    listUfsNaoConfiguradas,
} from '../services/itcdStrategies';
import { UF } from '../types';

const OBITO = '2025-06-15';
const SETTINGS = { applyInventoryDiscount: false };

// As 12 UFs cuja tabela o próprio código declarava estimada/pendente.
const NAO_CONFIGURADAS: UF[] = ['AC', 'AM', 'AP', 'BA', 'DF', 'MA', 'PA', 'PI', 'PR', 'RO', 'RR', 'TO'];
const TODAS_AS_UFS = Object.keys(ITCD_HOMOLOGACAO) as UF[];

describe('homologação das tabelas de ITCD', () => {
    it('as 12 UFs sem tabela conferida vêm marcadas como NAO_CONFIGURADA', () => {
        expect(listUfsNaoConfiguradas('CAUSA_MORTIS').sort()).toEqual([...NAO_CONFIGURADAS].sort());
    });

    it.each(NAO_CONFIGURADAS)('%s carimba confiabilidade, pendência e aviso no resultado', (uf) => {
        const resultado = calculateItcdForState(uf, 1_000_000, SETTINGS, OBITO, 'CAUSA_MORTIS');

        expect(resultado.confiabilidade).toBe('NAO_CONFIGURADA');
        expect(resultado.pendenciaHomologacao).toBeTruthy();
        expect(resultado.warningMessage).toContain(`SEFAZ/${uf}`);
    });

    it.each(TODAS_AS_UFS.filter(uf => !NAO_CONFIGURADAS.includes(uf)))(
        '%s está homologada para causa mortis e sai sem ressalva de tabela',
        (uf) => {
            const resultado = calculateItcdForState(uf, 1_000_000, SETTINGS, OBITO, 'CAUSA_MORTIS');

            expect(resultado.confiabilidade).toBe('HOMOLOGADA');
            expect(resultado.warningMessage || '').not.toContain('não está homologada');
        }
    );

    // O texto de placeholder era impresso no DOCX entregue ao cliente.
    it.each(TODAS_AS_UFS)('%s não publica texto de rascunho no legalText', (uf) => {
        const { legalText } = calculateItcdForState(uf, 1_000_000, SETTINGS, OBITO, 'CAUSA_MORTIS');

        expect(legalText).toBeTruthy();
        expect(legalText.toLowerCase()).not.toContain('aguardando configuração real');
        expect(legalText.toLowerCase()).not.toContain('estimad');
        expect(legalText.toLowerCase()).not.toContain('exemplo fornecido');
        expect(legalText.toLowerCase()).not.toContain('da imagem');
    });

    it('modo estrito recusa devolver número para UF não configurada', () => {
        expect(() => calculateItcdForStateStrict('PR', 1_000_000, SETTINGS, OBITO, 'CAUSA_MORTIS'))
            .toThrow(ItcdUfNaoConfiguradaError);

        expect(calculateItcdForStateStrict('SP', 1_000_000, SETTINGS, OBITO, 'CAUSA_MORTIS').taxAmount)
            .toBeCloseTo(40_000, 2);
    });

    it('UF fora do registro cai na regra padrão e nunca sai como homologada', () => {
        const resultado = calculateItcdForState('XX' as UF, 1_000_000, SETTINGS, OBITO, 'CAUSA_MORTIS');

        expect(resultado.taxAmount).toBeCloseTo(40_000, 2);
        expect(resultado.confiabilidade).toBe('NAO_CONFIGURADA');
        expect(resultado.pendenciaHomologacao).toContain('regra padrão nacional');
    });
});

describe('ITCD de doação (excesso de partilha)', () => {
    const COM_TABELA_DE_DOACAO: UF[] = ['MG', 'RS', 'SP'];

    it('só MG, RS e SP têm tabela de doação homologada', () => {
        expect(listUfsNaoConfiguradas('DOACAO').sort()).toEqual(
            TODAS_AS_UFS.filter(uf => !COM_TABELA_DE_DOACAO.includes(uf)).sort()
        );
    });

    it.each(TODAS_AS_UFS.filter(uf => !COM_TABELA_DE_DOACAO.includes(uf)))(
        '%s avisa que a doação foi calculada com a regra de causa mortis',
        (uf) => {
            const doacao = calculateItcdForState(uf, 1_000_000, SETTINGS, OBITO, 'DOACAO');

            expect(doacao.confiabilidade).toBe('NAO_CONFIGURADA');
            expect(doacao.warningMessage).toContain('Alíquota de doação não homologada');
        }
    );

    it('RS aplica a tabela de doação, distinta da de causa mortis', () => {
        const causaMortis = calculateItcdForState('RS', 1_000_000, SETTINGS, OBITO, 'CAUSA_MORTIS');
        const doacao = calculateItcdForState('RS', 1_000_000, SETTINGS, OBITO, 'DOACAO');

        // Doação: 10.000 UPF x 3% + 26.710,7195 UPF x 4% = 1.368,4288 UPF -> x 27,24
        expect(doacao.taxAmount).toBeCloseTo(37_276.0, 1);
        expect(doacao.taxAmount).not.toBeCloseTo(causaMortis.taxAmount, 2);
        expect(doacao.confiabilidade).toBe('HOMOLOGADA');
    });

    it('MG aplica a regra de doação (5% com desconto do art. 23-A)', () => {
        const doacao = calculateItcdForState('MG', 100_000, SETTINGS, OBITO, 'DOACAO');

        expect(doacao.taxAmount).toBeCloseTo(2_500, 2);
        expect(doacao.discountApplied).toContain('23-A');
        expect(doacao.confiabilidade).toBe('HOMOLOGADA');
    });

    it('SP cobra 4% nos dois fatos geradores, e isso está declarado na homologação', () => {
        const causaMortis = calculateItcdForState('SP', 1_000_000, SETTINGS, OBITO, 'CAUSA_MORTIS');
        const doacao = calculateItcdForState('SP', 1_000_000, SETTINGS, OBITO, 'DOACAO');

        expect(doacao.taxAmount).toBeCloseTo(causaMortis.taxAmount, 2);
        expect(doacao.confiabilidade).toBe('HOMOLOGADA');
        expect(ITCD_HOMOLOGACAO.SP.fonte).toContain('10.705');
    });
});
