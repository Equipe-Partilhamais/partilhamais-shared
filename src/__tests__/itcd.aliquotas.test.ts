import { describe, expect, it, vi } from 'vitest';
import { calculateItcdForState } from '../services/itcdStrategies';
import { UF } from '../types';

const OBITO = '2025-06-15';
const SETTINGS = { applyInventoryDiscount: false };

// Valores conferidos à mão a partir da tabela codificada em cada estratégia, com base de
// R$ 1.000.000,00. Um teste que só verifica "taxAmount > 0" passa com qualquer alíquota —
// era exatamente o que deixava passar as UFs com faixa inventada.
const ESPERADO_1M: Record<UF, number> = {
    AC: 40_000,       // 4% fixo
    AL: 40_000,       // art. 168, I, "a": até R$ 1.000.000 -> 4%
    AM: 40_000,       // enquadramento: acima de 400.000 -> 4%
    AP: 60_000,       // enquadramento: acima de 400.000 -> 6%
    BA: 80_000,       // art. 9º, II, "c": acima de 300.000 -> 8%
    CE: 80_000,       // 168.067,23 UFIRCE -> 8%
    DF: 40_000,       // marginal: 1.000.000 na primeira faixa (4%)
    ES: 40_000,       // 4% fixo
    GO: 63_500,       // art. 78 marginal: 500 + 7.000 + 24.000 + 32.000
    MA: 40_000,       // 4% fixo
    MG: 50_000,       // 5% fixo
    MS: 60_000,       // 6% fixo
    MT: 40_000,       // 4.175,19 UPF -> faixa até 8.000 UPF -> 4%
    PA: 40_000,       // 4% fixo
    PB: 49_500,       // art. 6º, I, decomposição em faixas: 2.500 + 11.000 + 36.000
    PE: 45_400,       // 8% - parcela a deduzir de 34.600
    PI: 40_000,       // 4% fixo
    PR: 40_000,       // 4% fixo
    RJ: 60_000,       // 215.053,76 UFIR-RJ -> faixa 200k-300k -> 6%
    RN: 30_000,       // 3% fixo
    RO: 40_000,       // enquadramento: acima de 300.000 -> 4%
    RR: 40_000,       // 4% fixo
    RS: 50_000,       // art. 18, § 1º: 36.710,7 UPF-RS -> faixa IV -> 5% sobre o total
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

    // O desconto de 15% de MG depende da data de RECOLHIMENTO, que o inventário não guarda.
    // Aplicá-lo pela data de hoje fazia o mesmo caso valer R$ 90.285 no navegador (BRT) e
    // R$ 106.218 no servidor (UTC). O motor devolve o imposto cheio e informa o benefício.
    it('MG não aplica o desconto de 15% sozinho, e informa o prazo para obtê-lo', () => {
        const resultado = calculateItcdForState('MG', 1_000_000, { applyInventoryDiscount: true }, '2025-06-06');

        expect(resultado.taxAmount).toBeCloseTo(50_000, 2);
        expect(resultado.originalTaxAmount).toBeCloseTo(50_000, 2);
        expect(resultado.warningMessage).toContain('04/09/2025');
    });

    it('MG devolve o mesmo imposto qualquer que seja o instante do cálculo', () => {
        const calcular = () => calculateItcdForState('MG', 1_000_000, { applyInventoryDiscount: true }, '2025-06-06').taxAmount;
        const primeira = calcular();

        vi.useFakeTimers();
        try {
            for (const instante of ['2025-06-07T03:00:00Z', '2025-09-05T23:59:00Z', '2027-01-01T12:00:00Z']) {
                vi.setSystemTime(new Date(instante));
                expect(calcular()).toBeCloseTo(primeira, 2);
            }
        } finally {
            vi.useRealTimers();
        }
    });

    it('base zero não gera imposto em nenhuma UF', () => {
        (Object.keys(ESPERADO_1M) as UF[]).forEach(uf => {
            expect(calculateItcdForState(uf, 0, SETTINGS, OBITO).taxAmount).toBe(0);
        });
    });
});
