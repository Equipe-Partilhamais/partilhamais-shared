import { describe, expect, it } from 'vitest';
import { fiscalUnitsApi } from '../services/fiscalUnitsApi';
import { calculateItcdForState } from '../services/itcdStrategies';

// "Fora da vigência" é derivado do último ponto publicado, e não escrito como ano literal:
// a série cresce a cada exercício e um ano fixo faria o caso quebrar na próxima IN/Resolução.
const ULTIMO_ANO_DA_SERIE_RJ = Number(fiscalUnitsApi.getUnit('RJ')!.vigenciaInicio.slice(0, 4));
const FORA_DA_VIGENCIA_RJ = `${ULTIMO_ANO_DA_SERIE_RJ + 1}-03-10`;

// Mesmo raciocínio para o conjunto das séries: o último exercício coberto por TODAS elas.
const ULTIMO_ANO_DAS_SERIES = Math.max(
    ...fiscalUnitsApi.getAllUnits().map(unidade => Number(unidade.vigenciaInicio.slice(0, 4))),
);

describe('séries de unidades fiscais', () => {
    it('resolve o valor pela data do fato gerador, não pela data de hoje', () => {
        const unidade = fiscalUnitsApi.getUnit('RJ', '2025-06-15');

        // UFIR-RJ de 2025: R$ 4,7508 (Resolução SEFAZ-RJ nº 746/2024, art. 1º).
        expect(unidade!.value).toBe(4.7508);
        expect(unidade!.vigenciaInicio).toBe('2025-01-01');
        expect(unidade!.outdated).toBe(false);
    });

    it('nenhum ponto da série está conferido na SEFAZ, mesmo cobrindo a data', () => {
        // Cobrir a vigência não é ter conferido o índice: a série inteira é referencial.
        const dentroDaVigencia = fiscalUnitsApi.getUnit('RJ', '2025-06-15')!;

        expect(dentroDaVigencia.outdated).toBe(false);
        expect(dentroDaVigencia.conferida).toBe(false);
        expect(fiscalUnitsApi.getAllUnits('2025-06-15').every(u => u.conferida === false)).toBe(true);
    });

    it('marca como desatualizado quando a série não cobre a data do fato gerador', () => {
        // Um óbito depois do último exercício publicado usa índice de outra competência.
        expect(fiscalUnitsApi.getUnit('RJ', FORA_DA_VIGENCIA_RJ)!.outdated).toBe(true);
        // Dentro do último exercício publicado, não há ressalva de cobertura.
        expect(fiscalUnitsApi.getUnit('RJ', `${ULTIMO_ANO_DA_SERIE_RJ}-03-10`)!.outdated).toBe(false);
        // Antes do primeiro ponto da série também não há valor confiável.
        expect(fiscalUnitsApi.getUnit('RJ', '2019-01-10')!.outdated).toBe(true);
        // Sem data não há como afirmar qual competência vale.
        expect(fiscalUnitsApi.getUnit('RJ')!.outdated).toBe(true);
    });

    it('não expõe atualização automática que não existe', () => {
        expect((fiscalUnitsApi as Record<string, unknown>).refreshRates).toBeUndefined();
    });

    it('lista as séries pendentes de índice real', () => {
        // Todas as séries já alcançam o último exercício cadastrado: nada pendente para ele.
        expect(fiscalUnitsApi.listSeriesPendentes(ULTIMO_ANO_DAS_SERIES)).toEqual([]);

        // Para o exercício seguinte, toda série cadastrada está pendente do índice novo.
        const pendentes = fiscalUnitsApi.listSeriesPendentes(ULTIMO_ANO_DAS_SERIES + 1)
            .map(item => item.uf)
            .sort();

        expect(pendentes).toEqual(['CE', 'MG', 'MT', 'PB', 'RJ', 'RO', 'RS', 'SE', 'SP'].sort());
        // AP não entra: lá não há série nenhuma, e sim bloqueio de índice.
        expect(pendentes).not.toContain('AP');
        expect(fiscalUnitsApi.listSeriesBloqueadas().map(item => item.uf)).toEqual(['AP']);
    });

    it('UF sem série cadastrada volta com fallback marcado como desatualizado e não conferido', () => {
        const unidade = fiscalUnitsApi.requireUnit('AC', { id: 'X', name: 'X', value: 1 }, '2025-06-15');

        expect(unidade.outdated).toBe(true);
        expect(unidade.conferida).toBe(false);
        expect(unidade.value).toBe(1);
    });

    it('o motor avisa que o índice não foi conferido, mesmo dentro da vigência', () => {
        // Era aqui que o defeito se escondia: para óbito em 2025 o cálculo saía sem ressalva
        // nenhuma sobre um índice que o próprio arquivo declara não conferido.
        const dentroDaVigencia = calculateItcdForState('RJ', 1_000_000, {}, '2025-06-15', 'CAUSA_MORTIS');
        expect(dentroDaVigencia.fiscalUnitUsed!.vigenciaInicio).toBe('2025-01-01');
        expect(dentroDaVigencia.fiscalUnitUsed!.outdated).toBe(false);
        expect(dentroDaVigencia.fiscalUnitUsed!.conferida).toBe(false);
        expect(dentroDaVigencia.warningMessage).toContain('é referencial e não foi conferido');
        expect(dentroDaVigencia.warningMessage).not.toContain('não cobre a data do fato gerador');
    });

    it('o motor expõe a vigência usada e avisa quando ela não cobre o óbito', () => {
        const foraDaVigencia = calculateItcdForState('RJ', 1_000_000, {}, FORA_DA_VIGENCIA_RJ, 'CAUSA_MORTIS');
        expect(foraDaVigencia.fiscalUnitUsed!.outdated).toBe(true);
        expect(foraDaVigencia.warningMessage).toContain('não cobre a data do fato gerador');
    });
});
