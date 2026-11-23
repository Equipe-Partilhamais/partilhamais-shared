import { describe, expect, it } from 'vitest';
import { calculatePartition } from '../services/partilha/motor';
import { calcularItcdDaUf } from '../services/partilha/itcdPorBeneficiario';
import { getPerfilItcdUf } from '../services/itcdStrategies/perfilUf';
import { bem, caso, conta, filho } from './caracterizacao/cenarios';
import { formatCurrency } from '../utils/formatters';

// CALC-01 (Crítica): o ITCD progressivo era calculado sobre o MONTE de cada UF, com uma única
// chamada da estratégia. CTN, art. 35, parágrafo único: há um fato gerador por herdeiro ou
// legatário — a alíquota e as isenções por valor se apuram QUINHÃO a quinhão.
//
// Valores do cartão (solteiro, 3 filhos, imóvel na UF, óbito em 2026). Onde o cartão diz
// "40.000" a soma das três guias é R$ 39.999,99: cada herdeiro recolhe a própria guia, de
// R$ 13.333,33 (1/3 de R$ 1.000.000,00 × 4%, arredondado a centavo — CALC-08).

const tresFilhos = [filho('f1'), filho('f2'), filho('f3')];
const imovelEm = (uf: string, valor: number) => caso({ heirs: tresFilhos, assets: [bem('imovel', valor, { state: uf })] });
const itcdDa = (r: ReturnType<typeof calculatePartition>, uf: string) => r.itcdBreakdown.find(i => i.state === uf)!;

describe('CALC-01 — ITCD por quinhão: os cenários do cartão', () => {
    it('RS, R$ 150.000 entre 3 filhos: cada quinhão (R$ 50.000) fica abaixo de 2.000 UPF-RS → 0', () => {
        const r = calculatePartition(imovelEm('RS', 150_000));
        expect(r.taxAmount).toBe(0);
        expect(itcdDa(r, 'RS').beneficiarios.map(b => b.taxAmount)).toEqual([0, 0, 0]);
    });

    it('RS, R$ 1.000.000 entre 3 filhos: 4% sobre cada quinhão, não 5% sobre o monte', () => {
        const r = calculatePartition(imovelEm('RS', 1_000_000));
        expect(itcdDa(r, 'RS').beneficiarios.map(b => b.taxAmount)).toEqual([13_333.33, 13_333.33, 13_333.33]);
        expect(r.taxAmount).toBe(39_999.99);
        expect(40_000 * 100 - Math.round(r.taxAmount * 100)).toBe(1); // um centavo abaixo do cartão: 3 guias arredondadas
    });

    it('BA, R$ 300.000 entre 3 filhos: quinhão de R$ 100.000 é isento (Lei 4.826/1989, art. 4º, V) → 0', () => {
        const r = calculatePartition(imovelEm('BA', 300_000));
        expect(r.taxAmount).toBe(0);
    });

    it('AL, R$ 2.400.000 entre 3 filhos: quinhão de R$ 800.000 a 4% → R$ 96.000', () => {
        const r = calculatePartition(imovelEm('AL', 2_400_000));
        expect(itcdDa(r, 'AL').beneficiarios.map(b => b.taxAmount)).toEqual([32_000, 32_000, 32_000]);
        expect(r.taxAmount).toBe(96_000);
    });

    it('SP (controle, alíquota fixa) não muda: R$ 40.000 com 1 e 2 herdeiros; 3 guias de R$ 13.333,33 com 3', () => {
        expect(calculatePartition(caso({ heirs: [filho('f1')], assets: [bem('imovel', 1_000_000)] })).taxAmount).toBe(40_000);
        expect(calculatePartition(caso({ heirs: [filho('f1'), filho('f2')], assets: [bem('imovel', 1_000_000)] })).taxAmount).toBe(40_000);
        expect(calculatePartition(imovelEm('SP', 1_000_000)).taxAmount).toBe(39_999.99);
    });
});

describe('CALC-01 — integração calculatePartition → ITCD', () => {
    it('devolve o ITCD por beneficiário e por UF, além do total, e as partes fecham com o todo', () => {
        const r = calculatePartition(imovelEm('RS', 1_000_000));
        const rs = itcdDa(r, 'RS');

        expect(rs.baseDeCalculo).toBe('QUINHAO');
        expect(rs.fundamentoBaseDeCalculo).toContain('CTN, art. 35, parágrafo único');
        expect(rs.beneficiarios.map(b => b.personId)).toEqual(['f1', 'f2', 'f3']);
        // As bases dos quinhões somam exatamente a base da UF (rateio pelo maior resto).
        expect(rs.beneficiarios.reduce((s, b) => s + Math.round(b.base * 100), 0)).toBe(Math.round(rs.taxBase * 100));
        expect(rs.taxBase).toBe(1_000_000);

        expect(r.itcdPorBeneficiario.map(p => p.personId)).toEqual(['f1', 'f2', 'f3']);
        r.itcdPorBeneficiario.forEach(p => {
            expect(p.porUf).toEqual([expect.objectContaining({ state: 'RS', taxAmount: 13_333.33 })]);
            expect(p.taxAmount).toBe(13_333.33);
        });
    });

    it('a memória de cálculo da UF fecha com o imposto e diz de quem é cada linha', () => {
        const r = calculatePartition(imovelEm('AL', 2_400_000));
        const al = itcdDa(r, 'AL');
        const soma = (al.calculationMemory || []).reduce((s, l) => s + Math.round(l.tax * 100), 0);
        expect(soma).toBe(Math.round(al.taxAmount * 100));
        expect((al.calculationMemory || []).every(l => /^f[123]: /.test(l.rangeLabel))).toBe(true);
    });

    it('a meação não entra na base: o cônjuge meeiro sem herança não é contribuinte', () => {
        // Comunhão parcial só com bens comuns: o cônjuge é meeiro e não concorre (art. 1.829, I).
        const r = calculatePartition(
            caso({
                deceased: { maritalRegime: 'COMUNHAO_PARCIAL', spouseName: 'Cônjuge' },
                heirs: [{ id: 'conj', name: 'Cônjuge', type: 'CONJUGE' }, filho('f1'), filho('f2')],
                assets: [bem('comum', 1_000_000, { origin: 'COMUM', state: 'RS' })],
            })
        );
        const rs = itcdDa(r, 'RS');
        expect(rs.taxBase).toBe(500_000);
        expect(rs.beneficiarios.map(b => b.personId)).toEqual(['f1', 'f2']);
        // 250 mil cada = 8.825,8 UPF-RS (faixa de 3%) → 7.500 por filho.
        expect(rs.beneficiarios.map(b => b.taxAmount)).toEqual([7_500, 7_500]);
    });

    it('o cônjuge que concorre só nos particulares paga ITCD só na UF dos particulares', () => {
        // Comum em SP (600 mil), particular no RS (300 mil): o cônjuge herda 1/3 do particular
        // e nada do comum (art. 1.829, I) — não pode aparecer como contribuinte em SP.
        const r = calculatePartition(
            caso({
                deceased: { maritalRegime: 'COMUNHAO_PARCIAL', spouseName: 'Cônjuge' },
                heirs: [{ id: 'conj', name: 'Cônjuge', type: 'CONJUGE' }, filho('f1'), filho('f2')],
                assets: [bem('comum', 600_000, { origin: 'COMUM' }), bem('particular', 300_000, { state: 'RS' })],
            })
        );
        const sp = itcdDa(r, 'SP');
        const rs = itcdDa(r, 'RS');
        expect(sp.beneficiarios.map(b => [b.personId, b.base])).toEqual([['f1', 150_000], ['f2', 150_000]]);
        expect(rs.beneficiarios.map(b => [b.personId, b.base])).toEqual([['conj', 100_000], ['f1', 100_000], ['f2', 100_000]]);
    });

    it('quem trouxe adiantamento à colação recebe menos do monte e tem base menor', () => {
        const r = calculatePartition(
            caso({
                heirs: [filho('f1'), filho('f2')],
                assets: [bem('imovel', 1_000_000), bem('adiant', 200_000, { type: 'ADIANTAMENTO', beneficiaryId: 'f1', state: undefined })],
            })
        );
        expect(itcdDa(r, 'SP').beneficiarios.map(b => [b.personId, b.base, b.taxAmount])).toEqual([
            ['f1', 400_000, 16_000],
            ['f2', 600_000, 24_000],
        ]);
    });

    it('sem herdeiro chamado não há quinhão: o ITCD da UF fica em 0 COM aviso, nunca em silêncio', () => {
        const r = calculatePartition(caso({ heirs: [], assets: [bem('imovel', 500_000)] }));
        const sp = itcdDa(r, 'SP');
        expect(sp.taxBase).toBe(500_000);
        expect(sp.taxAmount).toBe(0);
        expect(sp.beneficiarios).toEqual([]);
        expect(sp.warningMessage).toContain('sem beneficiário para ratear a base');
        expect(r.avisos).toEqual(expect.arrayContaining([expect.objectContaining({ codigo: 'ITCD_SEM_BENEFICIARIOS', ufs: ['SP'] })]));
    });

    it('o desconto projetado de MG é dito por beneficiário, não como se fosse o da UF', () => {
        const r = calculatePartition(
            caso({
                deceased: { lastResidenceState: 'MG' },
                heirs: [filho('f1'), filho('f2')],
                assets: [bem('imovel', 800_000, { state: 'MG' })],
                settings: { selectedState: 'MG', applyInventoryDiscount: true },
            })
        );
        const mg = itcdDa(r, 'MG');
        expect(mg.taxAmount).toBe(40_000);
        expect(mg.warningMessage).toContain('Por beneficiário');
        expect(mg.beneficiarios[0].warningMessage).toContain(formatCurrency(20_000));
    });
});

describe('CALC-01 — base MONTE (nenhuma UF hoje; o caminho existe e é testado direto)', () => {
    it('calcula uma vez sobre o monte e reparte o imposto pelos quinhões', () => {
        const perfil = { ...getPerfilItcdUf('RS'), baseDeCalculo: 'MONTE' as const, fonteBaseDeCalculo: 'teste' };
        const uf = calcularItcdDaUf({
            state: 'RS',
            baseCentavos: 100_000_000,
            pesos: [
                { personId: 'f1', personName: 'f1', personType: 'DESCENDENTE', peso: 1 },
                { personId: 'f2', personName: 'f2', personType: 'DESCENDENTE', peso: 1 },
                { personId: 'f3', personName: 'f3', personType: 'DESCENDENTE', peso: 1 },
            ],
            perfil,
            settings: { applyInventoryDiscount: false },
            deathDate: '2026-01-01',
            taxType: 'CAUSA_MORTIS',
        });
        expect(uf.taxAmount).toBe(50_000);
        expect(uf.beneficiarios.map(b => b.taxAmount).reduce((s, v) => s + v, 0)).toBe(50_000);
        expect(uf.baseDeCalculo).toBe('MONTE');
    });
});

describe('CALC-01 — nada mudou para quem tem um herdeiro só', () => {
    it('conta de R$ 1 milhão, um filho, domicílio MG: R$ 50.000', () => {
        const r = calculatePartition(caso({ deceased: { lastResidenceState: 'MG' }, heirs: [filho('f1')], assets: [conta('c', 1_000_000)] }));
        expect(r.taxAmount).toBe(50_000);
    });
});
