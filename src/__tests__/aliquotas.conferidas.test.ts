import { describe, expect, it } from 'vitest';
import { calculateItcdForState } from '../services/itcdStrategies';
import { fiscalUnitsApi } from '../services/fiscalUnitsApi';

const OBITO = '2025-06-15';
const SETTINGS = { applyInventoryDiscount: false };

const cm = (uf: string, base: number) =>
    calculateItcdForState(uf as any, base, SETTINGS, OBITO, 'CAUSA_MORTIS').taxAmount;
const doacao = (uf: string, base: number) =>
    calculateItcdForState(uf as any, base, SETTINGS, OBITO, 'DOACAO').taxAmount;

// Cada valor esperado abaixo foi calculado À MÃO a partir do texto do artigo citado, lido em
// fonte primária, e NÃO extraído da tabela do código — um valor copiado da implementação
// passaria mesmo com a faixa errada, que foi como as faixas inventadas sobreviveram até aqui.
//
// NENHUMA destas UFs está homologada: a conferência humana (`conferidaPor`/`conferidaEm` em
// homologacao.ts) continua em branco e o resultado segue saindo como NAO_CONFIGURADA.

describe('GO — CTE art. 78 (red. Lei nº 19.021/2015): progressividade marginal', () => {
    // A tabela não distingue o fato gerador; os dois caminhos têm de bater.
    it('decompõe em faixas os pontos de corte de R$ 25.000, R$ 200.000 e R$ 600.000', () => {
        // 25.000 x 2%
        expect(cm('GO', 25_000)).toBeCloseTo(500, 2);
        // 500 + (200.000 - 25.000) x 4%
        expect(cm('GO', 200_000)).toBeCloseTo(7_500, 2);
        // 7.500 + (600.000 - 200.000) x 6%
        expect(cm('GO', 600_000)).toBeCloseTo(31_500, 2);
        // 31.500 + (1.000.000 - 600.000) x 8%
        expect(cm('GO', 1_000_000)).toBeCloseTo(63_500, 2);
    });

    it('não é mais 4% fixo — o erro de R$ 23.500 em R$ 1 milhão sumiu', () => {
        expect(cm('GO', 1_000_000)).not.toBeCloseTo(40_000, 2);
        expect(doacao('GO', 1_000_000)).toBeCloseTo(63_500, 2);
    });
});

describe('PB — Lei nº 5.123/1989 art. 6º (red. Lei nº 12.585/2023): decomposição em faixas', () => {
    it('causa mortis (inciso I) quebra em 125k / 400k / 1M', () => {
        // 125.000 x 2%
        expect(cm('PB', 125_000)).toBeCloseTo(2_500, 2);
        // 2.500 + (400.000 - 125.000) x 4%
        expect(cm('PB', 400_000)).toBeCloseTo(13_500, 2);
        // 13.500 + (1.000.000 - 400.000) x 6%
        expect(cm('PB', 1_000_000)).toBeCloseTo(49_500, 2);
        // 49.500 + (2.000.000 - 1.000.000) x 8%
        expect(cm('PB', 2_000_000)).toBeCloseTo(129_500, 2);
    });

    it('doação (inciso II) tem quebras próprias: 125k / 1M / 2M', () => {
        expect(doacao('PB', 125_000)).toBeCloseTo(2_500, 2);
        // 2.500 + (1.000.000 - 125.000) x 4%
        expect(doacao('PB', 1_000_000)).toBeCloseTo(37_500, 2);
        // 37.500 + (2.000.000 - 1.000.000) x 6%
        expect(doacao('PB', 2_000_000)).toBeCloseTo(97_500, 2);
        // 97.500 + (3.000.000 - 2.000.000) x 8%
        expect(doacao('PB', 3_000_000)).toBeCloseTo(177_500, 2);
    });

    it('as duas tabelas divergem em R$ 1 milhão — não é a mesma tabela', () => {
        expect(cm('PB', 1_000_000)).not.toBeCloseTo(doacao('PB', 1_000_000), 2);
    });
});

// UPF-RS vigente no óbito: R$ 27,13 (IN RE nº 131/2024). Só a CONVERSÃO vem do código: os
// pontos de virada em reais envelhecem a cada correção do índice, enquanto a alíquota de cada
// faixa continua vindo da lei, conferida à mão como no resto do arquivo.
const UPF_RS = fiscalUnitsApi.getUnit('RS', OBITO)!.value;
const TETO_FAIXA_ISENTA = 2_000 * UPF_RS;   // R$ 54.260,00
const TETO_FAIXA_DE_3 = 10_000 * UPF_RS;    // R$ 271.300,00

describe('RS — Lei nº 8.821/1989 arts. 18 e 19: alíquota única sobre o quinhão', () => {
    // Faixas em UPF-RS. Onde a folga dentro da faixa não é o objeto do caso, o valor fica
    // longe do degrau para não depender do arredondamento da conversão.
    it('aplica a alíquota da faixa sobre o TODO, não por decomposição', () => {
        // 1.000.000 / 27,13 = 36.859,6 UPF -> faixa 30.000-50.000 -> 5% sobre o total
        expect(cm('RS', 1_000_000)).toBeCloseTo(50_000, 2);
        // a decomposição marginal que o motor fazia daria (240 + 800 + 342,978) x 27,13 =
        // 37.520,20 — R$ 12.479,80 a menos do que a lei manda cobrar
        expect(cm('RS', 1_000_000)).not.toBeCloseTo(37_520.2, 2);
    });

    it('respeita a faixa de 0% até 2.000 UPF-RS e o degrau seguinte', () => {
        // 2.000 UPF exatos: o teto da faixa I é inclusivo -> 0%
        expect(cm('RS', TETO_FAIXA_ISENTA)).toBe(0);
        // 2.100 UPF (R$ 56.973,00) -> faixa II -> 3% sobre os 56.973 inteiros
        expect(cm('RS', 2_100 * UPF_RS)).toBeCloseTo(1_709.19, 2);
    });

    it('vira de 3% para 4% em 10.000 UPF-RS, sempre sobre o total', () => {
        // 10.000 UPF exatos (R$ 271.300,00): ainda faixa II -> 271.300 x 3%
        expect(cm('RS', TETO_FAIXA_DE_3)).toBeCloseTo(8_139, 2);
        // 10.100 UPF (R$ 274.013,00) -> faixa III -> 4% sobre o total, não sobre o excedente
        expect(cm('RS', 10_100 * UPF_RS)).toBeCloseTo(10_960.52, 2);
    });

    it('doação tem tabela própria do art. 19: 3% até 10.000 UPF, 4% acima, sem faixa isenta', () => {
        expect(doacao('RS', 1_000)).toBeCloseTo(30, 2);
        expect(doacao('RS', TETO_FAIXA_DE_3)).toBeCloseTo(8_139, 2);
        expect(doacao('RS', 10_100 * UPF_RS)).toBeCloseTo(10_960.52, 2);
        expect(doacao('RS', 1_000_000)).toBeCloseTo(40_000, 2);
        // na doação não há faixa isenta: o que é 0% na causa mortis já paga 3%
        expect(doacao('RS', TETO_FAIXA_ISENTA)).toBeCloseTo(1_627.8, 2);
    });
});

describe('BA — Lei nº 4.826/1989 art. 9º (red. Lei nº 14.802/2024) e art. 4º, V', () => {
    it('isenta o quinhão de até R$ 100.000 (art. 4º, V), que antes pagava 3,5%', () => {
        expect(cm('BA', 90_000)).toBe(0);
        expect(cm('BA', 100_000)).toBe(0);
        // 100.000,01 já é "acima de R$ 100.000,00" -> 4% sobre o total
        expect(cm('BA', 100_001)).toBeCloseTo(4_000.04, 2);
    });

    it('enquadra o quinhão nas faixas de 4% / 6% / 8%', () => {
        expect(cm('BA', 200_000)).toBeCloseTo(8_000, 2);
        expect(cm('BA', 200_001)).toBeCloseTo(12_000.06, 2);
        expect(cm('BA', 300_000)).toBeCloseTo(18_000, 2);
        expect(cm('BA', 300_001)).toBeCloseTo(24_000.08, 2);
        expect(cm('BA', 1_000_000)).toBeCloseTo(80_000, 2);
    });

    it('doação tem tabela própria (art. 9º, I): 3% / 3,5% / 4%, sem isenção de piso', () => {
        expect(doacao('BA', 50_000)).toBeCloseTo(1_500, 2);
        expect(doacao('BA', 200_000)).toBeCloseTo(6_000, 2);
        expect(doacao('BA', 300_000)).toBeCloseTo(10_500, 2);
        // metade do que o código cobrava ao aplicar a tabela de causa mortis
        expect(doacao('BA', 1_000_000)).toBeCloseTo(40_000, 2);
    });
});

describe('AL — CTE/AL art. 168 (red. Lei nº 9.440/2024)', () => {
    it('causa mortis: 4% até R$ 1 milhão, 6% até R$ 10 milhões, 8% acima', () => {
        // as faixas de 25k/150k/300k que estavam no código punham este caso em 6%
        expect(cm('AL', 500_000)).toBeCloseTo(20_000, 2);
        expect(cm('AL', 1_000_000)).toBeCloseTo(40_000, 2);
        expect(cm('AL', 10_000_000)).toBeCloseTo(600_000, 2);
        expect(cm('AL', 10_000_001)).toBeCloseTo(800_000.08, 2);
    });

    it('doação (inciso II): 1% / 1,5% / 2%, três vezes menos que a tabela de causa mortis', () => {
        expect(doacao('AL', 50_000)).toBeCloseTo(500, 2);
        expect(doacao('AL', 100_000)).toBeCloseTo(1_500, 2);
        expect(doacao('AL', 1_000_000)).toBeCloseTo(20_000, 2);
    });
});

describe('as UFs corrigidas continuam NÃO homologadas', () => {
    // Corrigir a alíquota não assina a conferência. Se este teste cair, alguém preencheu
    // `conferidaPor`/`conferidaEm` sem advogado ter lido a lei — foi o pior defeito da auditoria.
    it.each(['GO', 'PB', 'RS', 'BA', 'AL'])('%s sai como NAO_CONFIGURADA e com ressalva', uf => {
        (['CAUSA_MORTIS', 'DOACAO'] as const).forEach(tipo => {
            const resultado = calculateItcdForState(uf as any, 1_000_000, SETTINGS, OBITO, tipo);
            expect(resultado.confiabilidade).toBe('NAO_CONFIGURADA');
            expect(resultado.pendenciaHomologacao).toBeTruthy();
            expect(resultado.warningMessage).toContain('não está homologada no PartilhaMais');
        });
    });
});
