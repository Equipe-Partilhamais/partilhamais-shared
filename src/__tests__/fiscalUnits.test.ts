import { describe, expect, it } from 'vitest';
import { fiscalUnitsApi } from '../services/fiscalUnitsApi';
import { calculateItcdForState } from '../services/itcdStrategies';

describe('séries de unidades fiscais', () => {
    it('resolve o valor pela data do fato gerador, não pela data de hoje', () => {
        const unidade = fiscalUnitsApi.getUnit('RJ', '2025-06-15');

        expect(unidade!.value).toBe(4.65);
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
        // A série vai até Jan/2025; um óbito em 2026 usa índice de outra competência.
        expect(fiscalUnitsApi.getUnit('RJ', '2026-03-10')!.outdated).toBe(true);
        // Antes do primeiro ponto da série também não há valor confiável.
        expect(fiscalUnitsApi.getUnit('RJ', '2019-01-10')!.outdated).toBe(true);
        // Sem data não há como afirmar qual competência vale.
        expect(fiscalUnitsApi.getUnit('RJ')!.outdated).toBe(true);
    });

    it('não expõe atualização automática que não existe', () => {
        expect((fiscalUnitsApi as Record<string, unknown>).refreshRates).toBeUndefined();
    });

    it('lista as séries pendentes de índice real', () => {
        const pendentes = fiscalUnitsApi.listSeriesPendentes(2026).map(item => item.uf).sort();

        expect(pendentes).toEqual(['CE', 'MG', 'PB', 'RJ', 'RS', 'SP', 'MT'].sort());
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
        const foraDaVigencia = calculateItcdForState('RJ', 1_000_000, {}, '2026-03-10', 'CAUSA_MORTIS');
        expect(foraDaVigencia.fiscalUnitUsed!.outdated).toBe(true);
        expect(foraDaVigencia.warningMessage).toContain('não cobre a data do fato gerador');
    });
});
