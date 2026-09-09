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

        // 2.000.000 / 4,7508 = 420.981,73 UFIR-RJ -> acima de 400.000 UFIR -> 8%
        expect(resultado.taxAmount).toBeCloseTo(160_000, 2);

        const linha = resultado.calculationMemory![0];
        expect(linha.tax).toBeCloseTo(160_000, 2);
        expect(linha.base).toBeCloseTo(2_000_000, 2);
        // O número em UFIR (420.981,73) é o que antes vazava para a coluna "Imposto".
        expect(linha.valueInUnits).toBeCloseTo(420_981.7294, 2);
        expect(linha.tax).not.toBeCloseTo(420_981.73, 2);
        expect(linha.unitName).toBe('UFIR-RJ');
        expect(linha.unitVigencia).toBe('2025-01-01');
    });

    it('RS — enquadramento único convertido para reais', () => {
        const resultado = calculateItcdForState('RS', 1_000_000, SETTINGS, OBITO, 'CAUSA_MORTIS');

        // 1.000.000 / 27,13 = 36.859,5651 UPF -> faixa de 30.000 a 50.000 UPF -> 5%
        // O art. 18, § 1º aplica a alíquota da faixa sobre o quinhão INTEIRO: 1.000.000 x 5%.
        expect(resultado.taxAmount).toBeCloseTo(50_000, 2);

        const memoria = resultado.calculationMemory!;
        // Uma linha só: a decomposição em faixas era o cálculo marginal que a lei não autoriza.
        expect(memoria).toHaveLength(1);
        expect(memoria[0].tax).toBeCloseTo(50_000, 2);
        expect(memoria[0].rate).toBeCloseTo(0.05, 4);
        expect(memoria[0].base).toBeCloseTo(1_000_000, 2);
        expect(memoria[0].valueInUnits).toBeCloseTo(36_859.5651, 4);
        expect(memoria[0].unitName).toBe('UPF/RS');
    });

    it('MT — a linha de conversão não gera imposto', () => {
        const resultado = calculateItcdForState('MT', 1_000_000, SETTINGS, OBITO, 'CAUSA_MORTIS');

        // 1.000.000 / 243,49 = 4.106,94 UPF -> faixa até 8.000 UPF -> 4% sobre o total
        expect(resultado.taxAmount).toBeCloseTo(40_000, 2);

        const [conversao, faixa] = resultado.calculationMemory!;
        expect(conversao.isConversionStep).toBe(true);
        expect(conversao.tax).toBe(0);
        expect(conversao.valueInUnits).toBeCloseTo(4_106.9448, 2);
        expect(faixa.tax).toBeCloseTo(40_000, 2);
        expect(faixa.base).toBeCloseTo(1_000_000, 2);
    });

    it('CE — a linha de conversão não gera imposto', () => {
        const resultado = calculateItcdForState('CE', 1_000_000, SETTINGS, OBITO, 'CAUSA_MORTIS');

        // 1.000.000 / 6,02969 = 165.846,01 UFIRCE -> acima de 10.000 UFIRCE -> 8%
        expect(resultado.taxAmount).toBeCloseTo(80_000, 2);

        const [conversao, faixa] = resultado.calculationMemory!;
        expect(conversao.tax).toBe(0);
        expect(conversao.valueInUnits).toBeCloseTo(165_846.0054, 2);
        expect(faixa.tax).toBeCloseTo(80_000, 2);
    });

    it('MG doação — memória fecha com o imposto, com e sem o desconto do art. 23-A', () => {
        // 1.000.000 / 5,5310 = 180.799,13 UFEMG -> acima de 90.000 -> sem desconto -> 5%
        const semDesconto = calculateItcdForState('MG', 1_000_000, SETTINGS, OBITO, 'DOACAO');
        expect(semDesconto.taxAmount).toBeCloseTo(50_000, 2);
        expect(somaImposto(semDesconto.calculationMemory)).toBeCloseTo(50_000, 2);

        // 100.000 / 5,5310 = 18.079,91 UFEMG -> até 90.000 -> desconto de 50% -> 5.000 - 2.500
        const comDesconto = calculateItcdForState('MG', 100_000, SETTINGS, OBITO, 'DOACAO');
        expect(comDesconto.taxAmount).toBeCloseTo(2_500, 2);
        expect(somaImposto(comDesconto.calculationMemory)).toBeCloseTo(2_500, 2);
        expect(comDesconto.calculationMemory![0].tax).toBe(0);
        expect(comDesconto.calculationMemory![0].valueInUnits).toBeCloseTo(18_079.9132, 2);
    });
});

const somaImposto = (memoria?: { tax: number }[]) =>
    (memoria || []).reduce((total, linha) => total + (linha.tax || 0), 0);
