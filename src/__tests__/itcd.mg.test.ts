import { describe, it, expect, afterEach, vi } from 'vitest';
import { calculateItcdForState } from '../services/itcdStrategies';
import { classifyItcdWarning } from '../services/itcdStrategies/warnings';

/**
 * O desconto de 15% de MG (Causa Mortis) era decidido comparando a data do óbito com
 * `new Date()`. O mesmo inventário rendia impostos diferentes no navegador (BRT) e no
 * servidor (UTC), e um óbito futuro ganhava o abatimento porque a diferença de datas
 * passava por `Math.abs`. Estes testes fixam o instante e o fuso justamente para provar
 * que o resultado não depende mais de nenhum dos dois.
 */

// Inventário cmouinkr2000104jotkmev6tc em produção: MG, desconto ligado, óbito 06/06/2025.
const BASE_REAL = 2_124_363.13;
const OBITO_REAL = '2025-06-06';
const IMPOSTO_CHEIO = 106_218.1565; // 5% de 2.124.363,13
const COM_DESCONTO = 90_285.43;     // o número que a tela exibia por causa do relógio

const DESCONTO_LIGADO = { applyInventoryDiscount: true };

// 2025-09-04T00:30Z é 03/09/2025 21:30 em BRT: o servidor já contava 90 dias completos
// desde o óbito e o navegador ainda não. Era a janela diária do disparo.
const INSTANTE_DIVERGENTE = new Date('2025-09-04T00:30:00.000Z');

const calcularMG = (base: number, obito?: string) =>
    calculateItcdForState('MG', base, DESCONTO_LIGADO, obito, 'CAUSA_MORTIS');

afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
});

describe('ITCD MG — desconto de 15% não pode depender do relógio', () => {
    it('devolve o mesmo imposto em qualquer instante do calendário', () => {
        const instantes = [
            '2025-06-07T12:00:00.000Z', // dia seguinte ao óbito
            INSTANTE_DIVERGENTE.toISOString(),
            '2025-09-04T23:59:00.000Z', // mesmo dia, outra hora
            '2026-09-09T09:00:00.000Z', // muito depois do prazo
        ];

        const impostos = instantes.map(instante => {
            vi.useFakeTimers();
            vi.setSystemTime(new Date(instante));
            const imposto = calcularMG(BASE_REAL, OBITO_REAL).taxAmount;
            vi.useRealTimers();
            return imposto;
        });

        expect(new Set(impostos.map(v => v.toFixed(2))).size).toBe(1);
        expect(impostos[0]).toBeCloseTo(IMPOSTO_CHEIO, 2);
    });

    it('não consulta o relógio do processo durante o cálculo', () => {
        // Prova direta: se a estratégia voltar a chamar `new Date()`/`Date.now()`, o espião acusa.
        const RelogioReal = Date;
        const construtorEspiao = vi.fn();
        const nowEspiao = vi.fn(() => RelogioReal.now());

        class DateVigiada extends RelogioReal {
            constructor(...args: any[]) {
                if (args.length === 0) {
                    construtorEspiao();
                    super(0);
                } else {
                    // @ts-expect-error repasse dos argumentos originais do construtor
                    super(...args);
                }
            }
            static now() {
                return nowEspiao();
            }
        }

        vi.stubGlobal('Date', DateVigiada);
        try {
            const resultado = calcularMG(BASE_REAL, OBITO_REAL);
            expect(resultado.taxAmount).toBeCloseTo(IMPOSTO_CHEIO, 2);
        } finally {
            vi.stubGlobal('Date', RelogioReal);
        }

        expect(construtorEspiao).not.toHaveBeenCalled();
        expect(nowEspiao).not.toHaveBeenCalled();
    });

    it('não aplica o desconto sem data de recolhimento — o inventário não guarda essa data', () => {
        vi.useFakeTimers();
        vi.setSystemTime(INSTANTE_DIVERGENTE);

        const resultado = calcularMG(BASE_REAL, OBITO_REAL);

        expect(resultado.taxAmount).toBeCloseTo(IMPOSTO_CHEIO, 2);
        expect(resultado.taxAmount).not.toBeCloseTo(COM_DESCONTO, 2);
        expect(resultado.taxAmount).toBe(resultado.originalTaxAmount);
        expect(resultado.discountApplied).toBe('');
        expect(resultado.discountValue).toBe(0);
    });

    it('informa o desconto potencial com o prazo contado do óbito, sem aplicá-lo', () => {
        const resultado = calcularMG(BASE_REAL, OBITO_REAL);

        // 06/06/2025 + 90 dias = 04/09/2025.
        expect(resultado.warningMessage).toContain('04/09/2025');
        expect(resultado.warningMessage).toContain('Desconto não calculado');
        expect(classifyItcdWarning(resultado.warningMessage)).toContain('PRAZO');
    });

    it('óbito futuro não ganha desconto — Math.abs tratava passado e futuro como iguais', () => {
        vi.useFakeTimers();
        vi.setSystemTime(INSTANTE_DIVERGENTE);

        // Óbito 27 dias à frente do instante fixado: o código antigo devolvia 90.285,43.
        const resultado = calcularMG(BASE_REAL, '2025-10-01');

        expect(resultado.taxAmount).toBeCloseTo(IMPOSTO_CHEIO, 2);
        expect(resultado.discountApplied).toBe('');
    });

    it('sem data do óbito o motor diz que o desconto não foi calculado', () => {
        const resultado = calcularMG(BASE_REAL, undefined);

        expect(resultado.taxAmount).toBeCloseTo(IMPOSTO_CHEIO, 2);
        expect(resultado.warningMessage).toContain('Data do óbito não informada');
        expect(classifyItcdWarning(resultado.warningMessage)).toContain('PRAZO');
    });

    it('data do óbito inexistente não vira prazo silenciosamente normalizado', () => {
        // `new Date(Date.UTC(2025, 1, 31))` viraria 03/03; o prazo sairia de uma data que não existe.
        const resultado = calcularMG(BASE_REAL, '2025-02-31');

        expect(resultado.warningMessage).toContain('Data do óbito não informada');
    });

    it('com o desconto desligado nenhuma ressalva de prazo é emitida', () => {
        const resultado = calculateItcdForState(
            'MG',
            BASE_REAL,
            { applyInventoryDiscount: false },
            OBITO_REAL,
            'CAUSA_MORTIS'
        );

        expect(resultado.taxAmount).toBeCloseTo(IMPOSTO_CHEIO, 2);
        expect(classifyItcdWarning(resultado.warningMessage)).not.toContain('PRAZO');
    });

    it('o fuso do processo não altera o imposto do mesmo caso', () => {
        // O front roda em BRT e o backend em UTC; o desconto divergia exatamente por isso.
        const porFuso = ['UTC', 'America/Sao_Paulo', 'Asia/Tokyo'].map(fuso => {
            vi.stubEnv('TZ', fuso);
            vi.useFakeTimers();
            vi.setSystemTime(INSTANTE_DIVERGENTE);
            const resultado = calcularMG(BASE_REAL, OBITO_REAL);
            vi.useRealTimers();
            return `${resultado.taxAmount.toFixed(2)}|${resultado.warningMessage}`;
        });

        expect(new Set(porFuso).size).toBe(1);
    });
});
