import { describe, expect, it } from 'vitest';
import { fiscalUnitsApi } from '../services/fiscalUnitsApi';
import { calculateItcdForState } from '../services/itcdStrategies';

describe('séries de unidades fiscais — resolução por competência', () => {
    it('série anual escolhe a vigência do ano do fato gerador, não a mais recente', () => {
        const obito2025 = fiscalUnitsApi.getUnit('RJ', '2025-06-15')!;
        const obito2026 = fiscalUnitsApi.getUnit('RJ', '2026-03-10')!;

        expect(obito2025.value).toBe(4.7508);
        expect(obito2025.vigenciaInicio).toBe('2025-01-01');
        expect(obito2026.value).toBe(4.9604);
        expect(obito2026.vigenciaInicio).toBe('2026-01-01');
        expect(obito2026.outdated).toBe(false);
    });

    it('série mensal escolhe o mês do fato gerador, não o ponto de janeiro', () => {
        // A UPF/MT muda todo mês (art. 47-B, § 3º da Lei 7.098/1998): fevereiro e setembro de 2026
        // são competências diferentes e não podem devolver o mesmo número.
        expect(fiscalUnitsApi.getUnit('MT', '2026-02-20')!.value).toBe(255.2);
        expect(fiscalUnitsApi.getUnit('MT', '2026-09-15')!.value).toBe(263.97);

        expect(fiscalUnitsApi.getUnit('PB', '2026-04-30')!.value).toBe(72.41);
        expect(fiscalUnitsApi.getUnit('PB', '2026-09-01')!.value).toBe(74.13);
    });

    it('nenhum ponto da série está conferido — pesquisa não é homologação', () => {
        expect(fiscalUnitsApi.getAllUnits('2026-03-10').every(u => u.conferida === false)).toBe(true);
        expect(fiscalUnitsApi.getAllUnits().every(u => u.conferida === false)).toBe(true);
    });
});

describe('buracos na série mensal', () => {
    it('mês sem valor publicado sai marcado, e não com o valor do mês anterior em silêncio', () => {
        // Só jan e dez/2025 foram levantados para a UPF/MT: junho é buraco.
        const buraco = fiscalUnitsApi.getUnit('MT', '2025-06-15')!;

        expect(buraco.lacunaNaSerie).toBe(true);
        expect(buraco.outdated).toBe(true);
        expect(buraco.vigenciaInicio).toBe('2025-01-01');
        expect(buraco.source).toContain('SÉRIE MENSAL SEM VALOR PARA 06/2025');
    });

    it('mês com valor próprio não é tratado como buraco', () => {
        const coberto = fiscalUnitsApi.getUnit('MT', '2026-07-04')!;

        expect(coberto.lacunaNaSerie).toBe(false);
        expect(coberto.outdated).toBe(false);
        expect(coberto.value).toBe(263.36);
    });

    it('o motor avisa quando o óbito cai em mês sem índice', () => {
        // Era este o silêncio: com um ponto por ano, o óbito de junho/2025 saía com o índice de
        // janeiro e sem ressalva nenhuma, mudando a faixa do imposto sem ninguém perceber.
        const emBuraco = calculateItcdForState('MT', 1_000_000, {}, '2025-06-15', 'CAUSA_MORTIS');
        const emMesPublicado = calculateItcdForState('MT', 1_000_000, {}, '2026-09-15', 'CAUSA_MORTIS');

        expect(emBuraco.fiscalUnitUsed!.outdated).toBe(true);
        expect(emBuraco.warningMessage).toContain('não cobre a data do fato gerador');
        expect(emMesPublicado.warningMessage).not.toContain('não cobre a data do fato gerador');
    });

    it('lista os meses sem vigência do ano, para a série mensal', () => {
        // Sergipe tem um único ponto (set/2026): os outros onze meses são buraco declarado.
        expect(fiscalUnitsApi.listLacunasMensais('SE', 2026)).toEqual([
            '2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06',
            '2026-07', '2026-08', '2026-10', '2026-11', '2026-12',
        ]);
        expect(fiscalUnitsApi.listLacunasMensais('MT', 2026)).toEqual(['2026-10', '2026-11', '2026-12']);
        // Série anual não tem competência mensal a cobrar.
        expect(fiscalUnitsApi.listLacunasMensais('RJ', 2026)).toEqual([]);
    });
});

describe('índice defasado mudava a faixa do imposto', () => {
    it('MT: com a UPF de set/2026 o acervo de R$ 1 milhão cai da faixa de 4% para a de 2%', () => {
        // Com a UPF parada em 239,51 a base dava 4.175 UPF (faixa de 4% = R$ 40.000).
        // Com 263,97 dá 3.788 UPF, dentro da faixa de 2%.
        const resultado = calculateItcdForState('MT', 1_000_000, {}, '2026-09-15', 'CAUSA_MORTIS');

        expect(resultado.fiscalUnitUsed!.value).toBe(263.97);
        expect(resultado.taxAmount).toBeCloseTo(20_000, 2);
        expect(resultado.effectiveRate).toBeCloseTo(0.02, 10);
    });

    it('RJ: com a UFIR-RJ de 2026 o acervo de R$ 950 mil fica na faixa de 5%, não na de 6%', () => {
        // 950.000 / 4,65 = 204.301 UFIR (acima de 200.000, faixa de 6%).
        // 950.000 / 4,9604 = 191.518 UFIR, faixa de 5%.
        const resultado = calculateItcdForState('RJ', 950_000, {}, '2026-03-10', 'CAUSA_MORTIS');

        expect(resultado.fiscalUnitUsed!.value).toBe(4.9604);
        expect(resultado.effectiveRate).toBe(0.05);
        expect(resultado.taxAmount).toBeCloseTo(47_500, 2);
    });

    it('MG: com a UFEMG de 2026 a doação de R$ 510 mil recupera o desconto de 50%', () => {
        // 90.000 UFEMG valiam R$ 505.800 com 5,62 (doação de 510 mil ficava de fora);
        // com 5,7899 o limite sobe para R$ 521.091 e o desconto do art. 23-A volta a caber.
        const resultado = calculateItcdForState('MG', 510_000, {}, '2026-05-10', 'DOACAO');

        expect(resultado.fiscalUnitUsed!.value).toBe(5.7899);
        expect(resultado.discountValue).toBeCloseTo(12_750, 2);
        expect(resultado.taxAmount).toBeCloseTo(12_750, 2);
    });
});

describe('UF sem índice em fonte oficial', () => {
    it('AP não entrega valor nenhum e diz por quê', () => {
        // O portal da SEFAZ-AP está com certificado vencido; inventar a UPF/AP converteria as
        // faixas do ITCD com índice errado.
        expect(fiscalUnitsApi.getUnit('AP', '2026-03-10')).toBeNull();
        expect(fiscalUnitsApi.getAllUnits('2026-03-10').some(u => u.name === 'UPF/AP')).toBe(false);

        const bloqueadas = fiscalUnitsApi.listSeriesBloqueadas();
        expect(bloqueadas.map(item => item.uf)).toEqual(['AP']);
        expect(bloqueadas[0].motivo).toContain('certificado TLS expirado');
    });

    it('requireUnit da UF bloqueada sai carimbado como índice indisponível', () => {
        const unidade = fiscalUnitsApi.requireUnit('AP', { id: 'UPF_AP', name: 'UPF/AP', value: 0 }, '2026-03-10');

        expect(unidade.indiceIndisponivel).toBe(true);
        expect(unidade.outdated).toBe(true);
        expect(unidade.conferida).toBe(false);
        expect(unidade.source).toContain('ÍNDICE INDISPONÍVEL');
        expect(unidade.source).toContain('NÃO serve de base de cálculo');
    });

    it('UF sem série cadastrada continua distinguível de UF bloqueada', () => {
        const semSerie = fiscalUnitsApi.requireUnit('AC', { id: 'X', name: 'X', value: 1 }, '2026-03-10');

        expect(semSerie.indiceIndisponivel).toBe(false);
        expect(semSerie.outdated).toBe(true);
        expect(semSerie.value).toBe(1);
    });

    it('RO deixou de ser bloqueada: a UPF/RO de 2026 está na SEFIN', () => {
        const unidade = fiscalUnitsApi.getUnit('RO', '2026-03-10')!;

        expect(unidade.value).toBe(124.46);
        expect(unidade.source).toContain('Resolução nº 3/2025/GAB/CRE');
        expect(unidade.conferida).toBe(false);
    });
});
