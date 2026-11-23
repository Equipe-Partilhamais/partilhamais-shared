import { describe, expect, it } from 'vitest';
import { calculatePartition } from '../services/partilha/motor';
import { distributeCents, toCents, toFraction } from '../utils/money';
import { bem, caso, conta, filho } from './caracterizacao/cenarios';

// CALC-08 (Baixa): sem arredondamento a centavo, R$ 100.000,01 entre 7 herdeiros saía na
// minuta como 7 × R$ 14.285,72 (soma R$ 100.000,04) e 7 × 14,2857% (soma 99,9999%), e o ITCD
// como 4000,0004. Agora: valores em centavos, rateio pelo maior resto (as partes somam
// exatamente o total), fração como razão (1/7) e ITCD de cada guia arredondado a centavo.

const sete = [1, 2, 3, 4, 5, 6, 7].map(n => filho(`f${n}`));
const casoDoCartao = caso({ heirs: sete, assets: [conta('conta', 100_000.01)] });

const centavosExatos = (v: number) => Math.abs(v * 100 - Math.round(v * 100)) < 1e-6;
const soma = (valores: number[]) => valores.reduce((s, v) => s + toCents(v), 0);

describe('CALC-08 — R$ 100.000,01 entre 7 herdeiros', () => {
    it('os quinhões somam exatamente o monte, cada um no piso ou no teto de 1/7', () => {
        const r = calculatePartition(casoDoCartao);
        for (const campo of ['theoreticalValue', 'inheritanceValue', 'totalTargetValue'] as const) {
            const valores = r.targets.map(t => t[campo]);
            expect(soma(valores)).toBe(10_000_001);
            expect(valores.every(v => v === 14_285.71 || v === 14_285.72)).toBe(true);
        }
        expect(r.targets.filter(t => t.theoreticalValue === 14_285.72)).toHaveLength(4);
    });

    it('os percentuais somam 100,0000% e a fração é a razão 1/7', () => {
        const r = calculatePartition(casoDoCartao);
        const unidades = r.targets.map(t => Math.round(t.percentageOfEstate * 10_000));
        expect(unidades.reduce((s, u) => s + u, 0)).toBe(1_000_000);
        r.targets.forEach(t => expect(t.fracaoDoMonte).toEqual({ numerador: 1, denominador: 7, texto: '1/7' }));
    });

    it('o ITCD de cada guia é arredondado a centavo, e o total é a soma das guias', () => {
        const r = calculatePartition(casoDoCartao);
        const guias = r.itcdBreakdown[0].beneficiarios.map(b => b.taxAmount);
        expect(guias.every(g => g === 571.43)).toBe(true);
        expect(r.taxAmount).toBe(4_000.01);
    });

    it('nenhum valor monetário do resultado tem fração de centavo', () => {
        const r = calculatePartition(casoDoCartao);
        const valores = [
            r.totalAssets, r.netEstate, r.successionBase, r.disposablePortion, r.compulsoryPortion, r.taxAmount,
            r.deedFee, r.registryFee, r.notaryFee,
            ...r.targets.flatMap(t => [t.theoreticalValue, t.inheritanceValue, t.legitimaValue, t.totalTargetValue, t.grossTargetValue]),
            ...r.itcdBreakdown.flatMap(i => [i.taxBase, i.taxAmount, ...i.beneficiarios.map(b => b.base)]),
        ];
        expect(valores.filter(v => !centavosExatos(v))).toEqual([]);
    });
});

describe('CALC-08 — meação, emolumentos e doação também em centavos', () => {
    it('meação de valor ímpar em centavos: meio-para-cima ao meeiro e o resto exato ao herdeiro', () => {
        const r = calculatePartition(
            caso({
                deceased: { maritalRegime: 'COMUNHAO_PARCIAL', spouseName: 'Cônjuge' },
                heirs: [{ id: 'conj', name: 'Cônjuge', type: 'CONJUGE' }, filho('f1')],
                assets: [bem('comum', 100_000.01, { origin: 'COMUM' })],
            })
        );
        expect(r.totalMeacao).toBe(50_000.01);
        expect(r.targets.find(t => t.personId === 'f1')!.totalTargetValue).toBe(50_000);
    });

    it('emolumentos com margem de segurança saem a centavo', () => {
        // R$ 100,01 × 1,15 = R$ 115,0115: a margem gera fração de centavo.
        const r = calculatePartition({
            ...caso({ heirs: [filho('f1')], assets: [bem('imovel', 333_333.33)] }),
            feeTables: { SP: [{ min: 0, max: null, deed: 100.01, registry: 100.01 }] },
            feeMetadata: {},
        });
        expect([r.deedFee, r.registryFee, r.notaryFee]).toEqual([115.01, 115.01, 230.02]);
    });

    it('atribuição de um bem entre três pessoas fecha com o valor do bem', () => {
        const r = calculatePartition(
            caso({
                heirs: [filho('f1'), filho('f2'), filho('f3')],
                assets: [
                    conta('conta', 100_000.01, {
                        assignments: [
                            { personId: 'f1', percentage: 33.3333 },
                            { personId: 'f2', percentage: 33.3333 },
                            { personId: 'f3', percentage: 33.3334 },
                        ],
                    }),
                ],
            })
        );
        expect(soma(r.targets.map(t => t.grossAllocatedValue))).toBe(10_000_001);
    });

    it('evento de doação por excesso de quinhão sai a centavo', () => {
        const r = calculatePartition(
            caso({
                heirs: [filho('c1', { residenceState: 'MG' }), filho('c2', { residenceState: 'RJ' }), filho('c3', { residenceState: 'RJ' })],
                assets: [conta('conta', 100_000.01, { assignments: [{ personId: 'c1', percentage: 100 }] })],
            })
        );
        expect(r.donationBreakdown.length).toBeGreaterThan(0);
        r.donationBreakdown.forEach(e => expect(centavosExatos(e.value) && centavosExatos(e.taxAmount)).toBe(true));
        expect(centavosExatos(r.totalExcessTax)).toBe(true);
    });
});

describe('CALC-08 — utilitários', () => {
    it('distributeCents reparte pelo maior resto e a soma é o total', () => {
        expect(distributeCents(10_000_001, [1, 1, 1, 1, 1, 1, 1])).toEqual([1_428_572, 1_428_572, 1_428_572, 1_428_572, 1_428_571, 1_428_571, 1_428_571]);
        expect(distributeCents(100, [1, 0, 1])).toEqual([50, 0, 50]);
    });

    it('toCents arredonda meio-para-cima pelo decimal, não pelo binário', () => {
        expect(toCents(2_126_265.145)).toBe(212_626_515);
        expect(toCents(50_000.005)).toBe(5_000_001);
        expect(toCents(-0.005)).toBe(-1);
    });

    it('toFraction devolve a razão quando ela existe e null quando o quinhão depende de valor', () => {
        expect(toFraction(1 / 7)).toEqual({ numerador: 1, denominador: 7, texto: '1/7' });
        expect(toFraction(0.25)?.texto).toBe('1/4');
        expect(toFraction(1)?.texto).toBe('1');
        expect(toFraction(0.123456789)).toBeNull();
    });
});
