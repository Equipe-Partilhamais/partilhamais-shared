import { describe, expect, it } from 'vitest';
import { calculateItcdForState } from '../services/itcdStrategies';
import { UF } from '../types';

const OBITO = '2025-06-15';
const SETTINGS = { applyInventoryDiscount: false };

// Valores conferidos à mão a partir da tabela codificada em cada estratégia, com base de
// R$ 1.000.000,00. Um teste que só verifica "taxAmount > 0" passa com qualquer alíquota —
// era exatamente o que deixava passar as UFs com faixa inventada.
const ESPERADO_1M: Record<UF, number> = {
    AC: 40_000,       // 4% fixo
    AL: 60_000,       // enquadramento: acima de 300.000 -> 6%
    AM: 40_000,       // enquadramento: acima de 400.000 -> 4%
    AP: 60_000,       // enquadramento: acima de 400.000 -> 6%
    BA: 80_000,       // enquadramento: acima de 300.000 -> 8%
    CE: 80_000,       // 168.067,23 UFIRCE -> 8%
    DF: 40_000,       // marginal: 1.000.000 na primeira faixa (4%)
    ES: 40_000,       // 4% fixo
    GO: 40_000,       // 4% fixo
    MA: 40_000,       // 4% fixo
    MG: 50_000,       // 5% fixo
    MS: 60_000,       // 6% fixo
    MT: 40_000,       // 4.175,19 UPF -> faixa até 8.000 UPF -> 4%
    PA: 40_000,       // 4% fixo
    PB: 40_000,       // 4% fixo
    PE: 45_400,       // 8% - parcela a deduzir de 34.600
    PI: 40_000,       // 4% fixo
    PR: 40_000,       // 4% fixo
    RJ: 60_000,       // 215.053,76 UFIR-RJ -> faixa 200k-300k -> 6%
    RN: 30_000,       // 3% fixo
    RO: 40_000,       // enquadramento: acima de 300.000 -> 4%
    RR: 40_000,       // 4% fixo
    RS: 37_469.6,     // marginal em UPF: (240 + 800 + 335,536) x 27,24
    SC: 65_600,       // marginal: 200 + 900 + 5.000 + 59.500
    SE: 80_000,       // 8% fixo
    SP: 40_000,       // 4% fixo
    TO: 80_000,       // enquadramento: acima de 800.000 -> 8%
};

describe('alíquotas de ITCD por UF (causa mortis, base de R$ 1.000.000)', () => {
    it.each(Object.entries(ESPERADO_1M))('%s cobra o valor esperado', (uf, esperado) => {
        const resultado = calculateItcdForState(uf as UF, 1_000_000, SETTINGS, OBITO, 'CAUSA_MORTIS');

        expect(resultado.taxAmount).toBeCloseTo(esperado, 2);
        expect(resultado.effectiveRate).toBeCloseTo(esperado / 1_000_000, 6);
    });

    it('PE aplica a parcela a deduzir em cada faixa', () => {
        // 300.000 x 2% - 1.600 = 4.400
        expect(calculateItcdForState('PE', 300_000, SETTINGS, OBITO).taxAmount).toBeCloseTo(4_400, 2);
        // até 80.000 é isento
        expect(calculateItcdForState('PE', 80_000, SETTINGS, OBITO).taxAmount).toBe(0);
    });

    it('MT isenta até 1.500 UPF', () => {
        // 1.500 x 239,51 = 359.265; abaixo disso a alíquota da faixa é 0%
        expect(calculateItcdForState('MT', 359_265, SETTINGS, OBITO).taxAmount).toBe(0);
        expect(calculateItcdForState('MT', 400_000, SETTINGS, OBITO).taxAmount).toBeCloseTo(8_000, 2);
    });

    it('MG concede 15% de desconto quando o óbito é recente e o desconto está ligado', () => {
        const trintaDiasAtras = new Date();
        trintaDiasAtras.setDate(trintaDiasAtras.getDate() - 30);
        const obitoRecente = trintaDiasAtras.toISOString().split('T')[0];

        const resultado = calculateItcdForState('MG', 1_000_000, { applyInventoryDiscount: true }, obitoRecente);

        expect(resultado.taxAmount).toBeCloseTo(42_500, 2);
        expect(resultado.originalTaxAmount).toBeCloseTo(50_000, 2);
    });

    it('base zero não gera imposto em nenhuma UF', () => {
        (Object.keys(ESPERADO_1M) as UF[]).forEach(uf => {
            expect(calculateItcdForState(uf, 0, SETTINGS, OBITO).taxAmount).toBe(0);
        });
    });
});
