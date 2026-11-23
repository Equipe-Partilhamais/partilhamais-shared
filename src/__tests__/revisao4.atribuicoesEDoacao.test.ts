import { describe, expect, it } from 'vitest';
import { calculatePartition } from '../services/partilha/motor';
import { bem, caso, conta, filho } from './caracterizacao/cenarios';

// Lacunas achadas na integração do frontend: o app reproduzia o rateio de centavos das
// atribuições (regra de cálculo fora do motor), cruzava aviso com evento de doação para saber
// se a competência era estimada, e não via aviso quando a atribuição tinha líquido negativo.

const centavos = (v: number) => Math.round(v * 100);
const exato = (v: number) => Math.abs(v * 100 - Math.round(v * 100)) < 1e-6;

describe('1. valor de cada atribuição, como o motor usa (`atribuicoes`)', () => {
    it('imóvel de 1.000.000,01 com 33,33% de titularidade, dividido 33,33/33,33/33,34: as partes somam o bem e batem com grossAllocatedValue', () => {
        const r = calculatePartition(
            caso({
                heirs: [filho('f1'), filho('f2'), filho('f3')],
                assets: [
                    bem('i', 1_000_000.01, {
                        ownershipPercentage: 33.33,
                        assignments: [
                            { personId: 'f1', percentage: 33.33 },
                            { personId: 'f2', percentage: 33.33 },
                            { personId: 'f3', percentage: 33.34 },
                        ],
                    }),
                ],
            })
        );
        const doBem = r.atribuicoes.filter(a => a.assetId === 'i');
        expect(doBem.map(a => a.personId)).toEqual(['f1', 'f2', 'f3']);
        expect(doBem.map(a => a.fracao?.texto)).toEqual(['3333/10000', '3333/10000', '1667/5000']);
        // Valor do bem (33,33% de 1.000.000,01) = 333.300,00 em centavos exatos.
        const valorDoBem = r.assetDebtSummary.find(s => s.assetId === 'i')!.netValue;
        expect(doBem.reduce((s, a) => s + centavos(a.valorLiquido), 0)).toBe(centavos(valorDoBem));
        expect(doBem.every(a => exato(a.valorLiquido) && exato(a.valorBruto))).toBe(true);
        // Por pessoa, a soma das atribuições é o grossAllocatedValue do alvo.
        r.targets.forEach(t => {
            const soma = r.atribuicoes.filter(a => a.personId === t.personId).reduce((s, a) => s + centavos(a.valorLiquido), 0);
            expect(soma).toBe(centavos(t.grossAllocatedValue));
        });
    });

    it('com dívida vinculada: bruto antes do abatimento, líquido depois', () => {
        const r = calculatePartition(
            caso({
                heirs: [filho('f1'), filho('f2')],
                assets: [bem('i', 1_000_000, { assignments: [{ personId: 'f1', percentage: 50 }, { personId: 'f2', percentage: 50 }] })],
                liabilities: [{ id: 'd', description: 'Financiamento', value: 300_000, origin: 'PARTICULAR', partitionTreatment: 'BEM_VINCULADO', assetLinks: [{ assetId: 'i', deductedValue: 300_000 }] }],
            })
        );
        expect(r.atribuicoes.map(a => [a.personId, a.percentage, a.valorBruto, a.valorLiquido])).toEqual([
            ['f1', 50, 500_000, 350_000],
            ['f2', 50, 500_000, 350_000],
        ]);
    });
});

describe('2. o evento de doação diz se a competência é estimada (`competenciaEstimada`)', () => {
    const doacao = (doador: Record<string, unknown>, donatario: Record<string, unknown> = { residenceState: 'MG' }) =>
        calculatePartition(
            caso({
                heirs: [filho('c1', donatario), filho('c2', doador)],
                assets: [conta('conta', 200_000, { assignments: [{ personId: 'c1', percentage: 100 }] })],
            })
        ).donationBreakdown[0];

    it('doador sem domicílio informado: estimada, motivo DOMICILIO_DO_DOADOR_NAO_INFORMADO', () => {
        const e = doacao({});
        expect(e.competenciaEstimada).toBe(true);
        expect(e.motivoCompetenciaEstimada).toBe('DOMICILIO_DO_DOADOR_NAO_INFORMADO');
    });

    it('doador no exterior e donatário sem domicílio: motivo DOMICILIO_DO_DONATARIO_NAO_INFORMADO', () => {
        const e = doacao({ domiciledAbroad: true }, {});
        expect(e.motivoCompetenciaEstimada).toBe('DOMICILIO_DO_DONATARIO_NAO_INFORMADO');
    });

    it('doador e donatário no exterior: motivo DOADOR_E_DONATARIO_NO_EXTERIOR', () => {
        const e = doacao({ domiciledAbroad: true }, { domiciledAbroad: true });
        expect(e.motivoCompetenciaEstimada).toBe('DOADOR_E_DONATARIO_NO_EXTERIOR');
    });

    it('domicílio do doador informado: não estimada, sem motivo', () => {
        const e = doacao({ residenceState: 'RJ' });
        expect(e.competenciaEstimada).toBe(false);
        expect(e.motivoCompetenciaEstimada).toBeUndefined();
    });
});

describe('3. atribuição com valor líquido negativo', () => {
    // MG: imóvel de 200 mil com financiamento vinculado de 300 mil todo para Ana; conta de 500 mil para Bruno.
    const casoMG = () =>
        calculatePartition(
            caso({
                deceased: { lastResidenceState: 'MG' },
                settings: { selectedState: 'MG' },
                heirs: [filho('ana', { name: 'Ana', residenceState: 'MG' }), filho('bruno', { name: 'Bruno', residenceState: 'MG' })],
                assets: [
                    bem('imovel', 200_000, { state: 'MG', assignments: [{ personId: 'ana', percentage: 100 }] }),
                    conta('conta', 500_000, { assignments: [{ personId: 'bruno', percentage: 100 }] }),
                ],
                liabilities: [{ id: 'fin', description: 'Financiamento', value: 300_000, origin: 'PARTICULAR', partitionTreatment: 'BEM_VINCULADO', assetLinks: [{ assetId: 'imovel', deductedValue: 300_000 }] }],
            })
        );

    it('o cálculo não muda: Ana com −100 mil e doação de 300 mil de Ana para Bruno (R$ 7.500)', () => {
        const r = casoMG();
        expect(r.targets.find(t => t.personId === 'ana')!.allocatedValue).toBe(-100_000);
        expect(r.donationBreakdown.map(e => [e.donorId, e.receiverId, e.value, e.taxAmount])).toEqual([['ana', 'bruno', 300_000, 7_500]]);
    });

    it('aviso ATRIBUICAO_COM_LIQUIDO_NEGATIVO com pessoas, bens e valores, que trava a minuta', () => {
        const r = casoMG();
        const aviso = r.avisos.find(a => a.codigo === 'ATRIBUICAO_COM_LIQUIDO_NEGATIVO')!;
        expect(aviso).toEqual(
            expect.objectContaining({
                gravidade: 'EXIGE_CONFIRMACAO',
                pessoas: ['ana'],
                bens: ['imovel'],
                valores: { valorBruto: 200_000, dividaVinculada: 300_000, valorLiquido: -100_000, doacaoGerada: 300_000 },
            })
        );
        expect(aviso.mensagem).toContain('doação');
        expect(r.minuta.motivos.map(m => m.codigo)).toContain('ATRIBUICAO_COM_LIQUIDO_NEGATIVO');
    });

    it('sem atribuição negativa, sem aviso', () => {
        const r = calculatePartition(caso({ heirs: [filho('f1')], assets: [bem('i', 100_000, { assignments: [{ personId: 'f1', percentage: 100 }] })] }));
        expect(r.avisos.some(a => a.codigo === 'ATRIBUICAO_COM_LIQUIDO_NEGATIVO')).toBe(false);
    });
});
