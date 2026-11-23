import { describe, expect, it } from 'vitest';
import { calculatePartition } from '../services/partilha/motor';
import { getPrivateEstateFactor, shouldSpouseCompeteWithDescendants } from '../services/successionCore';
import { bem, caso, filho } from './caracterizacao/cenarios';

// CALC-02 (Crítica): na comunhão universal a meação incidia também sobre o bem PARTICULAR.
// O particular nesse regime é justamente o que a lei exclui da comunhão (CC, art. 1.668:
// doado ou herdado com cláusula de incomunicabilidade, sub-rogados, etc.). Meação só sobre o
// comum (CC, art. 1.667); e o cônjuge casado nesse regime não concorre com os descendentes
// (CC, art. 1.829, I) — o particular vai inteiro para os filhos.

const conjuge = { id: 'conj', name: 'Cônjuge', type: 'CONJUGE' };
const casoDoCartao = caso({
    deceased: { maritalRegime: 'COMUNHAO_UNIVERSAL', spouseName: 'Cônjuge' },
    heirs: [conjuge, filho('f1'), filho('f2')],
    assets: [bem('comum', 800_000, { origin: 'COMUM' }), bem('particular', 200_000)],
});

describe('CALC-02 — comunhão universal: meação só sobre o comum', () => {
    it('comum 800 mil + particular 200 mil, cônjuge e 2 filhos, SP → meação 400 mil, 300 mil por filho, ITCD 24.000', () => {
        const r = calculatePartition(casoDoCartao);
        const alvo = (id: string) => r.targets.find(t => t.personId === id)!;

        expect(r.totalMeacao).toBe(400_000);
        expect(alvo('conj').meacaoValue).toBe(400_000);
        // Não concorre com descendentes (art. 1.829, I): nada de herança para o cônjuge.
        expect(alvo('conj').inheritanceValue).toBe(0);
        expect(alvo('f1').totalTargetValue).toBe(300_000);
        expect(alvo('f2').totalTargetValue).toBe(300_000);

        expect(r.itcdBreakdown[0].taxBase).toBe(600_000);
        expect(r.taxAmount).toBe(24_000);
    });

    it('o fator do acervo particular é 1 na comunhão universal (meação não alcança o particular)', () => {
        expect(getPrivateEstateFactor('COMUNHAO_UNIVERSAL', true)).toBe(1);
        expect(shouldSpouseCompeteWithDescendants('COMUNHAO_UNIVERSAL', true)).toBe(false);
    });

    it('avisa que bem particular na comunhão universal só existe nas hipóteses do art. 1.668', () => {
        const r = calculatePartition(casoDoCartao);
        expect(r.avisos).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    codigo: 'COMUNHAO_UNIVERSAL_COM_BEM_PARTICULAR',
                    categoria: 'REGIME_DE_BENS',
                    bens: ['particular'],
                }),
            ])
        );
    });

    it('sem bem particular nada muda: meação de metade do comum e nenhum aviso de regime', () => {
        const r = calculatePartition(
            caso({
                deceased: { maritalRegime: 'COMUNHAO_UNIVERSAL', spouseName: 'Cônjuge' },
                heirs: [conjuge, filho('f1'), filho('f2')],
                assets: [bem('comum', 1_000_000, { origin: 'COMUM' })],
            })
        );
        expect(r.totalMeacao).toBe(500_000);
        expect(r.avisos.some(a => a.codigo === 'COMUNHAO_UNIVERSAL_COM_BEM_PARTICULAR')).toBe(false);
    });

    it('o registro do imóvel particular passa a usar o valor inteiro transmitido', () => {
        const r = calculatePartition(casoDoCartao);
        const soParticular = calculatePartition(
            caso({ heirs: [filho('f1')], assets: [bem('particular', 200_000)] })
        );
        // Emolumento de registro do imóvel particular = o de um imóvel de 200 mil transmitido inteiro.
        const registroDoComum = calculatePartition(
            caso({
                deceased: { maritalRegime: 'COMUNHAO_UNIVERSAL', spouseName: 'Cônjuge' },
                heirs: [conjuge, filho('f1')],
                assets: [bem('comum', 800_000, { origin: 'COMUM' })],
            })
        ).registryFee;
        expect(Math.round((r.registryFee - registroDoComum) * 100)).toBe(Math.round(soParticular.registryFee * 100));
    });
});
