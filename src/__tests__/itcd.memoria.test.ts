import { describe, expect, it } from 'vitest';
import { calculateItcdForState } from '../services/itcdStrategies';
import { UF } from '../types';

// Data de óbito dentro da vigência das unidades fiscais cadastradas (2025), para o resultado
// não depender do relógio da máquina que roda o teste.
const OBITO = '2025-06-15';
const SETTINGS = { applyInventoryDiscount: false };

const TODAS_AS_UFS: UF[] = [
    'AC', 'AL', 'AM', 'AP', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MG', 'MS', 'MT',
    'PA', 'PB', 'PE', 'PI', 'PR', 'RJ', 'RN', 'RO', 'RR', 'RS', 'SC', 'SE', 'SP', 'TO',
];

describe('memória de cálculo do ITCD', () => {
    // Invariante que faltava: a coluna "Imposto" da memória é impressa com formatCurrency() na
    // tela e no DOCX; se ela não somar o imposto do cabeçalho, o documento se contradiz.
    it.each(TODAS_AS_UFS)('%s: a soma da coluna Imposto fecha com o imposto devido', (uf) => {
        const resultado = calculateItcdForState(uf, 1_000_000, SETTINGS, OBITO, 'CAUSA_MORTIS');
        const memoria = resultado.calculationMemory;

        if (!memoria || memoria.length === 0) return;

        const soma = memoria.reduce((total, linha) => total + (linha.tax || 0), 0);
        expect(soma).toBeCloseTo(resultado.taxAmount, 2);
    });

    it('RJ — caso real de R$ 2.000.000: memória em reais, não em UFIR', () => {
        const resultado = calculateItcdForState('RJ', 2_000_000, SETTINGS, OBITO, 'CAUSA_MORTIS');

        // 2.000.000 / 4,65 = 430.107,53 UFIR-RJ -> acima de 400.000 UFIR -> 8%
        expect(resultado.taxAmount).toBeCloseTo(160_000, 2);

        const linha = resultado.calculationMemory![0];
        expect(linha.tax).toBeCloseTo(160_000, 2);
        expect(linha.base).toBeCloseTo(2_000_000, 2);
        // O número em UFIR (430.107,53) é o que antes vazava para a coluna "Imposto".
        expect(linha.valueInUnits).toBeCloseTo(430_107.5268, 2);
        expect(linha.tax).not.toBeCloseTo(430_107.53, 2);
        expect(linha.unitName).toBe('UFIR-RJ');
        expect(linha.unitVigencia).toBe('2025-01-01');
    });

    it('RS — faixas marginais convertidas para reais', () => {
        const resultado = calculateItcdForState('RS', 1_000_000, SETTINGS, OBITO, 'CAUSA_MORTIS');

        // 1.000.000 / 27,24 = 36.710,7195 UPF
        // 2.000 UPF isentos | 8.000 UPF x 3% = 240 | 20.000 x 4% = 800 | 6.710,7195 x 5% = 335,536 UPF
        // (240 + 800 + 335,536) x 27,24 = 37.469,60
        expect(resultado.taxAmount).toBeCloseTo(37_469.6, 2);

        const memoria = resultado.calculationMemory!;
        expect(memoria).toHaveLength(4);
        expect(memoria[0].tax).toBeCloseTo(0, 2);
        expect(memoria[1].tax).toBeCloseTo(6_537.6, 2);
        expect(memoria[2].tax).toBeCloseTo(21_792, 2);
        expect(memoria[3].tax).toBeCloseTo(9_140, 2);
        expect(memoria[1].base).toBeCloseTo(217_920, 2);
        expect(memoria[1].valueInUnits).toBeCloseTo(8_000, 4);
    });

    it('MT — a linha de conversão não gera imposto', () => {
        const resultado = calculateItcdForState('MT', 1_000_000, SETTINGS, OBITO, 'CAUSA_MORTIS');

        // 1.000.000 / 239,51 = 4.175,19 UPF -> faixa até 8.000 UPF -> 4% sobre o total
        expect(resultado.taxAmount).toBeCloseTo(40_000, 2);

        const [conversao, faixa] = resultado.calculationMemory!;
        expect(conversao.isConversionStep).toBe(true);
        expect(conversao.tax).toBe(0);
        expect(conversao.valueInUnits).toBeCloseTo(4_175.191, 2);
        expect(faixa.tax).toBeCloseTo(40_000, 2);
        expect(faixa.base).toBeCloseTo(1_000_000, 2);
    });

    it('CE — a linha de conversão não gera imposto', () => {
        const resultado = calculateItcdForState('CE', 1_000_000, SETTINGS, OBITO, 'CAUSA_MORTIS');

        // 1.000.000 / 5,95 = 168.067,23 UFIRCE -> acima de 10.000 UFIRCE -> 8%
        expect(resultado.taxAmount).toBeCloseTo(80_000, 2);

        const [conversao, faixa] = resultado.calculationMemory!;
        expect(conversao.tax).toBe(0);
        expect(conversao.valueInUnits).toBeCloseTo(168_067.2269, 2);
        expect(faixa.tax).toBeCloseTo(80_000, 2);
    });

    it('MG doação — memória fecha com o imposto, com e sem o desconto do art. 23-A', () => {
        // 1.000.000 / 5,62 = 177.935,94 UFEMG -> acima de 90.000 -> sem desconto -> 5%
        const semDesconto = calculateItcdForState('MG', 1_000_000, SETTINGS, OBITO, 'DOACAO');
        expect(semDesconto.taxAmount).toBeCloseTo(50_000, 2);
        expect(somaImposto(semDesconto.calculationMemory)).toBeCloseTo(50_000, 2);

        // 100.000 / 5,62 = 17.793,59 UFEMG -> até 90.000 -> desconto de 50% -> 5.000 - 2.500
        const comDesconto = calculateItcdForState('MG', 100_000, SETTINGS, OBITO, 'DOACAO');
        expect(comDesconto.taxAmount).toBeCloseTo(2_500, 2);
        expect(somaImposto(comDesconto.calculationMemory)).toBeCloseTo(2_500, 2);
        expect(comDesconto.calculationMemory![0].tax).toBe(0);
        expect(comDesconto.calculationMemory![0].valueInUnits).toBeCloseTo(17_793.594, 2);
    });
});

const somaImposto = (memoria?: { tax: number }[]) =>
    (memoria || []).reduce((total, linha) => total + (linha.tax || 0), 0);
