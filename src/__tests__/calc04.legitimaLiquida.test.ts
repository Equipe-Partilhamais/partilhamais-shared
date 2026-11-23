import { describe, expect, it } from 'vitest';
import { calculatePartition } from '../services/partilha/motor';
import { bem, caso, filho } from './caracterizacao/cenarios';

// CALC-04 (Alta): a legítima e a parte disponível eram calculadas sobre o monte BRUTO; o
// passivo do espólio (tratamento ESPOLIO, o padrão do formulário) só entrava no "patrimônio
// líquido projetado". CC, art. 1.847: a legítima se calcula sobre os bens existentes na abertura
// da sucessão, ABATIDAS AS DÍVIDAS e as despesas do funeral, somando-se depois a colação. A
// redução das disposições inoficiosas (arts. 1.966/1.967) usa esse valor.

const dividaDoEspolio = (valor: number, extra: Record<string, unknown> = {}) => ({
    id: 'd1',
    description: 'Empréstimo',
    value: valor,
    origin: 'PARTICULAR',
    partitionTreatment: 'ESPOLIO',
    ...extra,
});
const legatario = (extra: Record<string, unknown>) => ({ id: 't1', name: 'Legatário', type: 'TESTAMENTARIO', ...extra });

describe('CALC-04 — legítima e disponível sobre o monte líquido do passivo do espólio', () => {
    it('monte 1 mi, dívida do espólio 600 mil, 1 filho, legado de 450 mil → disponível 200 mil e legado excessivo', () => {
        const r = calculatePartition(
            caso({
                deceased: { hasWill: true },
                heirs: [filho('f1'), legatario({ testamentaryMode: 'SPECIFIC_ASSETS' })],
                assets: [
                    bem('legado', 450_000, { assignments: [{ personId: 't1', percentage: 100, value: 450_000, lockReason: 'TESTAMENT' }] }),
                    bem('outro', 550_000),
                ],
                liabilities: [dividaDoEspolio(600_000)],
            })
        );

        expect(r.monteLiquido).toBe(400_000);
        expect(r.disposablePortion).toBe(200_000);
        expect(r.compulsoryPortion).toBe(200_000);
        expect(r.testamentaryTotal).toBe(450_000);
        expect(r.isTestamentaryExcessive).toBe(true);
        // A redução do art. 1.967 corta o legado até a disponível líquida.
        expect(r.targets.find(t => t.personId === 't1')!.testamentaryValue).toBe(200_000);

        expect(r.avisos).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    codigo: 'DISPOSICAO_INOFICIOSA',
                    categoria: 'LEGITIMA',
                    gravidade: 'EXIGE_CONFIRMACAO',
                    valores: expect.objectContaining({ disponivel: 200_000, disposto: 450_000, excesso: 250_000 }),
                }),
            ])
        );
        expect(r.minuta.exigeConfirmacao).toBe(true);
    });

    // Revisão (b): este teste congelava um erro — dava ao testamentário 200 mil LÍQUIDOS e ao
    // filho 800 mil BRUTOS, pondo todo o passivo no herdeiro legítimo. O herdeiro de quota
    // responde pelas dívidas na proporção do quinhão (CC, art. 1.997): cada um recebe 500 mil
    // brutos, suporta 300 mil do passivo e fica com 200 mil líquidos (1/2).
    it('quota testamentária de 50% com passivo de 600 mil: metade do bruto e metade da dívida para cada, sem inoficiosidade', () => {
        const r = calculatePartition(
            caso({
                deceased: { hasWill: true },
                heirs: [filho('f1'), legatario({ testamentaryMode: 'PERCENTAGE_OF_ESTATE', testamentaryPercentage: 50 })],
                assets: [bem('imovel', 1_000_000)],
                liabilities: [dividaDoEspolio(600_000)],
            })
        );

        expect(r.disposablePortion).toBe(200_000);
        // O disposto, para a inoficiosidade, é o LÍQUIDO: 50% de 400 mil = 200 mil = disponível.
        expect(r.testamentaryTotal).toBe(200_000);
        expect(r.isTestamentaryExcessive).toBe(false);
        for (const id of ['t1', 'f1']) {
            const alvo = r.targets.find(t => t.personId === id)!;
            expect(alvo.theoreticalValue).toBe(500_000);
            expect(alvo.passivoDoEspolio).toBe(300_000);
            expect(alvo.liquidoProjetado).toBe(200_000);
        }
        // O líquido do filho é exatamente a legítima.
        expect(r.targets.find(t => t.personId === 'f1')!.liquidoProjetado).toBe(r.compulsoryPortion);
        expect(r.avisos.some(a => a.codigo === 'DISPOSICAO_INOFICIOSA')).toBe(false);
    });

    it('a dívida comum do espólio é rateada: metade cabe à meação, metade à herança', () => {
        const r = calculatePartition(
            caso({
                deceased: { maritalRegime: 'COMUNHAO_PARCIAL', spouseName: 'Cônjuge' },
                heirs: [{ id: 'conj', name: 'Cônjuge', type: 'CONJUGE' }, filho('f1')],
                assets: [bem('comum', 1_000_000, { origin: 'COMUM' })],
                liabilities: [dividaDoEspolio(200_000, { origin: 'COMUM' })],
            })
        );
        // Herança 500 mil − metade da dívida comum (100 mil) = 400 mil; disponível 200 mil.
        expect(r.monteLiquido).toBe(400_000);
        expect(r.disposablePortion).toBe(200_000);
    });

    it('dívida sem origem informada é rateada entre comum e particular na proporção dos acervos', () => {
        const r = calculatePartition(
            caso({
                deceased: { maritalRegime: 'COMUNHAO_PARCIAL', spouseName: 'Cônjuge' },
                heirs: [{ id: 'conj', name: 'Cônjuge', type: 'CONJUGE' }, filho('f1')],
                assets: [bem('comum', 600_000, { origin: 'COMUM' }), bem('particular', 400_000)],
                liabilities: [dividaDoEspolio(100_000, { origin: undefined })],
            })
        );
        // 60 mil no comum (30 mil à herança) + 40 mil no particular = 70 mil; herança 700 − 70 = 630 mil.
        expect(r.monteLiquido).toBe(630_000);
        expect(r.disposablePortion).toBe(315_000);
    });

    it('informa que a legítima foi calculada sobre o monte líquido', () => {
        const r = calculatePartition(caso({ heirs: [filho('f1')], assets: [bem('imovel', 1_000_000)], liabilities: [dividaDoEspolio(600_000)] }));
        expect(r.avisos).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ codigo: 'LEGITIMA_SOBRE_MONTE_LIQUIDO', categoria: 'LEGITIMA', fundamento: expect.stringContaining('1.847') }),
            ])
        );
    });

    // Revisão: a herança insolvente passou a ter aviso próprio, que TRAVA a minuta; antes era a
    // variante "ATENCAO" do aviso de legítima e a minuta saía sem confirmação.
    it('passivo maior que o monte: não há disponível, e o aviso de insolvência cita o art. 1.792 e trava a minuta', () => {
        const r = calculatePartition(caso({ heirs: [filho('f1')], assets: [bem('imovel', 300_000)], liabilities: [dividaDoEspolio(500_000)] }));
        expect(r.monteLiquido).toBe(0);
        expect(r.disposablePortion).toBe(0);
        const aviso = r.avisos.find(a => a.codigo === 'HERANCA_INSOLVENTE')!;
        expect(aviso.gravidade).toBe('EXIGE_CONFIRMACAO');
        expect(aviso.mensagem).toContain('1.792');
        expect(r.avisos.some(a => a.codigo === 'LEGITIMA_SOBRE_MONTE_LIQUIDO')).toBe(false);
    });

    it('sem passivo do espólio nada muda: disponível = metade do monte', () => {
        const r = calculatePartition(caso({ heirs: [filho('f1')], assets: [bem('imovel', 1_000_000)] }));
        expect(r.disposablePortion).toBe(500_000);
        expect(r.monteLiquido).toBe(1_000_000);
        expect(r.avisos.some(a => a.categoria === 'LEGITIMA')).toBe(false);
    });
});
