import { afterEach, describe, expect, it } from 'vitest';
import {
    calculateItcdForState,
    conferenciaValida,
    ConferenciaHumana,
    criarConferencia,
    getConferencia,
    getPendencia,
    ITCD_HOMOLOGACAO,
    isHomologada,
    listUfsNaoConfiguradas,
    UfHomologacao,
} from '../services/itcdStrategies';
import { ItcdTaxType } from '../services/itcdStrategies/types';
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
        const registro: UfHomologacao = {
            ...ITCD_HOMOLOGACAO.SP,
            causaMortis: criarConferencia({
                conferidaPor: 'Fulano',
                conferidaEm: '2026-01-02',
                referencia: 'Lei nº 10.705/2000, art. 16',
            }),
        };
        expect(registro.causaMortis?.conferidaPor).toBe('Fulano');
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

        // Doação (art. 19, § 1º): 1.000.000 / 27,13 = 36.859,5651 UPF -> acima de 10.000 UPF
        // -> 4% sobre o valor INTEIRO da doação, e não sobre o excedente da faixa.
        expect(doacao.taxAmount).toBeCloseTo(40_000, 2);
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

// Grava direto no registro o que um descuido (ou um selo forjado) gravaria, sem passar pela
// fronteira de validação. É o caminho pelo qual `causaMortis: {}` chegava a "HOMOLOGADA".
const forjarConferencia = (uf: UF, taxType: ItcdTaxType, selo: unknown): void => {
    const campo = taxType === 'DOACAO' ? 'doacao' : 'causaMortis';
    ITCD_HOMOLOGACAO[uf][campo] = selo as ConferenciaHumana;
};

const limparConferencia = (uf: UF): void => {
    delete ITCD_HOMOLOGACAO[uf].causaMortis;
    delete ITCD_HOMOLOGACAO[uf].doacao;
};

describe('selo de conferência sem conteúdo não homologa', () => {
    afterEach(() => limparConferencia('SP'));

    // A porta destrancada: o motor testava a EXISTÊNCIA do objeto, não o conteúdo. Cada selo
    // abaixo apagava o aviso de valor referencial do relatório entregue ao cliente.
    const selosInvalidos: Array<[string, unknown]> = [
        ['objeto vazio', {}],
        ['sem quem conferiu', { conferidaPor: '', conferidaEm: '2025-01-15', referencia: 'Lei nº 10.705/2000, art. 16' }],
        ['quem conferiu só com espaços', { conferidaPor: '   ', conferidaEm: '2025-01-15', referencia: 'Lei nº 10.705/2000, art. 16' }],
        ['data futura', { conferidaPor: 'Dra. Fulana (OAB/SP 123)', conferidaEm: '2999-01-01', referencia: 'Lei nº 10.705/2000, art. 16' }],
        ['data inexistente no calendário', { conferidaPor: 'Dra. Fulana (OAB/SP 123)', conferidaEm: '2025-02-30', referencia: 'Lei nº 10.705/2000, art. 16' }],
        ['data fora do formato AAAA-MM-DD', { conferidaPor: 'Dra. Fulana (OAB/SP 123)', conferidaEm: '15/01/2025', referencia: 'Lei nº 10.705/2000, art. 16' }],
        ['sem referência', { conferidaPor: 'Dra. Fulana (OAB/SP 123)', conferidaEm: '2025-01-15', referencia: '' }],
        ['referência sem artigo', { conferidaPor: 'Dra. Fulana (OAB/SP 123)', conferidaEm: '2025-01-15', referencia: 'Lei nº 10.705/2000' }],
        ['referência sem norma', { conferidaPor: 'Dra. Fulana (OAB/SP 123)', conferidaEm: '2025-01-15', referencia: 'art. 16' }],
    ];

    it.each(selosInvalidos)('%s não homologa a UF', (_rotulo, selo) => {
        forjarConferencia('SP', 'CAUSA_MORTIS', selo);

        expect(isHomologada('SP', 'CAUSA_MORTIS')).toBe(false);
        expect(getConferencia('SP', 'CAUSA_MORTIS')).toBeUndefined();
        expect(listUfsNaoConfiguradas('CAUSA_MORTIS')).toContain('SP');
    });

    it.each(selosInvalidos)('%s: o resultado continua saindo com ressalva', (_rotulo, selo) => {
        forjarConferencia('SP', 'CAUSA_MORTIS', selo);

        const resultado = calculateItcdForState('SP', 1_000_000, SETTINGS, OBITO, 'CAUSA_MORTIS');

        expect(resultado.confiabilidade).toBe('NAO_CONFIGURADA');
        expect(resultado.pendenciaHomologacao).toBeTruthy();
        expect(resultado.warningMessage).toContain('SEFAZ/SP');
    });

    it('selo vazio na doação também não homologa nem cala o aviso', () => {
        forjarConferencia('SP', 'DOACAO', {});

        const doacao = calculateItcdForState('SP', 1_000_000, SETTINGS, OBITO, 'DOACAO');

        expect(isHomologada('SP', 'DOACAO')).toBe(false);
        expect(doacao.confiabilidade).toBe('NAO_CONFIGURADA');
        expect(doacao.warningMessage).toContain('Alíquota de doação não homologada');
        expect(doacao.pendenciaHomologacao).toBeTruthy();
    });
});

describe('criarConferencia: a fronteira que recusa assinatura sem conteúdo', () => {
    afterEach(() => limparConferencia('SP'));

    const VALIDA = {
        conferidaPor: 'Dra. Fulana (OAB/SP 123.456)',
        conferidaEm: '2025-01-15',
        referencia: 'Lei nº 10.705/2000, art. 16, vigente desde 01/01/2001',
    };

    it('conferência assinada e completa homologa a UF', () => {
        ITCD_HOMOLOGACAO.SP.causaMortis = criarConferencia(VALIDA);

        expect(isHomologada('SP', 'CAUSA_MORTIS')).toBe(true);
        expect(getConferencia('SP', 'CAUSA_MORTIS')?.conferidaPor).toBe(VALIDA.conferidaPor);
        expect(listUfsNaoConfiguradas('CAUSA_MORTIS')).not.toContain('SP');

        const resultado = calculateItcdForState('SP', 1_000_000, SETTINGS, OBITO, 'CAUSA_MORTIS');
        expect(resultado.confiabilidade).toBe('HOMOLOGADA');
        expect(resultado.pendenciaHomologacao).toBeUndefined();
    });

    it('causa mortis conferida não homologa a doação: a pendência passa a ser a da doação', () => {
        ITCD_HOMOLOGACAO.SP.causaMortis = criarConferencia(VALIDA);

        expect(isHomologada('SP', 'DOACAO')).toBe(false);
        expect(getPendencia('SP', 'DOACAO')).toContain('doação (inter vivos)');
    });

    it.each([
        ['sem quem conferiu', { ...VALIDA, conferidaPor: '   ' }],
        ['data futura', { ...VALIDA, conferidaEm: '2999-01-01' }],
        ['data inexistente', { ...VALIDA, conferidaEm: '2025-02-30' }],
        ['data fora do formato', { ...VALIDA, conferidaEm: '15/01/2025' }],
        ['referência vazia', { ...VALIDA, referencia: '' }],
        ['referência sem artigo', { ...VALIDA, referencia: 'Lei nº 10.705/2000' }],
        ['referência sem norma', { ...VALIDA, referencia: 'art. 16' }],
    ])('recusa %s', (_rotulo, dados) => {
        expect(() => criarConferencia(dados)).toThrow(/Conferência de ITCD inválida/);
    });

    it('conferenciaValida rejeita o que não é objeto de conferência', () => {
        expect(conferenciaValida({})).toBe(false);
        expect(conferenciaValida(undefined)).toBe(false);
        expect(conferenciaValida(null)).toBe(false);
        expect(conferenciaValida('Dra. Fulana, 2025-01-15')).toBe(false);
        expect(conferenciaValida(criarConferencia(VALIDA))).toBe(true);
    });

    it('a data de hoje é aceita: o corte é o futuro, não o presente', () => {
        const hoje = new Date().toISOString().slice(0, 10);

        expect(() => criarConferencia({ ...VALIDA, conferidaEm: hoje })).not.toThrow();
    });
});
