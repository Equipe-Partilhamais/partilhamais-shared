import { describe, expect, it } from 'vitest';
import { calculatePartition } from '../services/partilha/motor';
import { bem, caso, filho } from './caracterizacao/cenarios';

// Achado na integração do backend: incoerência entre o regime de bens e a presença de cônjuge
// passava em silêncio. O CÁLCULO não muda (a caracterização contra os motores antigos segue sem
// diferença declarada); só a incerteza passa a aparecer, e trava a minuta quando muda a partilha.

const conjuge = { id: 'conj', name: 'Cônjuge', type: 'CONJUGE' };
const doisFilhos = [filho('f1'), filho('f2')];
const aviso = (r: ReturnType<typeof calculatePartition>, codigo: string) => r.avisos.find(a => a.codigo === codigo);
const alvo = (r: ReturnType<typeof calculatePartition>, id: string) => r.targets.find(t => t.personId === id)!;

describe('cônjuge cadastrado com regime SOLTEIRO ou sem regime', () => {
    it('caso da integração: SOLTEIRO, cônjuge + 2 filhos, imóvel de 900 mil em SP — cálculo igual, aviso e trava', () => {
        const r = calculatePartition(caso({ deceased: { maritalRegime: 'SOLTEIRO' }, heirs: [conjuge, ...doisFilhos], assets: [bem('i', 900_000)] }));
        expect(alvo(r, 'conj').totalTargetValue).toBe(0);
        expect(alvo(r, 'f1').totalTargetValue).toBe(450_000);
        expect(alvo(r, 'f2').totalTargetValue).toBe(450_000);
        expect(aviso(r, 'CONJUGE_SEM_REGIME_DE_BENS')).toEqual(
            expect.objectContaining({ categoria: 'REGIME_DE_BENS', gravidade: 'EXIGE_CONFIRMACAO', pessoas: ['conj'] })
        );
        expect(r.minuta.exigeConfirmacao).toBe(true);
    });

    it('regime ausente também conta como incoerente', () => {
        const r = calculatePartition(caso({ deceased: { maritalRegime: undefined }, heirs: [conjuge, ...doisFilhos], assets: [bem('i', 900_000)] }));
        expect(aviso(r, 'CONJUGE_SEM_REGIME_DE_BENS')?.gravidade).toBe('EXIGE_CONFIRMACAO');
    });

    it('nome do cônjuge preenchido com regime SOLTEIRO: o cônjuge é ignorado — aviso e trava', () => {
        const r = calculatePartition(caso({ deceased: { maritalRegime: 'SOLTEIRO', spouseName: 'Fulana' }, heirs: doisFilhos, assets: [bem('i', 900_000)] }));
        expect(r.targets.map(t => t.personId)).toEqual(['f1', 'f2']);
        expect(aviso(r, 'CONJUGE_SEM_REGIME_DE_BENS')?.gravidade).toBe('EXIGE_CONFIRMACAO');
    });

    it('sem descendentes e sem bem comum o regime não muda a partilha: aviso de atenção, sem trava', () => {
        const r = calculatePartition(caso({ deceased: { maritalRegime: 'SOLTEIRO' }, heirs: [conjuge], assets: [bem('i', 900_000)] }));
        expect(alvo(r, 'conj').totalTargetValue).toBe(900_000);
        expect(aviso(r, 'CONJUGE_SEM_REGIME_DE_BENS')?.gravidade).toBe('ATENCAO');
        expect(r.minuta.motivos.some(m => m.categoria === 'REGIME_DE_BENS')).toBe(false);
    });
});

describe('isSpouse com tipo diferente de cônjuge, e mais de um cônjuge', () => {
    it('type OUTROS + isSpouse + testamento: tratado como cônjuge (cálculo igual), com aviso e trava', () => {
        const r = calculatePartition(
            caso({
                deceased: { maritalRegime: 'COMUNHAO_PARCIAL', hasWill: true },
                heirs: [{ id: 'm', name: 'Meeira', type: 'OUTROS', isSpouse: true, testamentaryMode: 'PERCENTAGE_OF_ESTATE', testamentaryPercentage: 10 }, filho('f1')],
                assets: [bem('c', 1_000_000, { origin: 'COMUM' })],
            })
        );
        expect(alvo(r, 'm').meacaoValue).toBe(500_000);
        expect(aviso(r, 'CONJUGE_MARCADO_SO_POR_ISSPOUSE')).toEqual(
            expect.objectContaining({ categoria: 'REGIME_DE_BENS', gravidade: 'EXIGE_CONFIRMACAO', pessoas: ['m'] })
        );
        expect(r.minuta.exigeConfirmacao).toBe(true);
    });

    it('dois cadastros de cônjuge: o motor usa o primeiro — aviso e trava', () => {
        const r = calculatePartition(
            caso({
                deceased: { maritalRegime: 'COMUNHAO_PARCIAL' },
                heirs: [conjuge, { id: 'conj2', name: 'Outro', type: 'CONJUGE' }, filho('f1')],
                assets: [bem('c', 1_000_000, { origin: 'COMUM' })],
            })
        );
        expect(aviso(r, 'MAIS_DE_UM_CONJUGE')).toEqual(expect.objectContaining({ gravidade: 'EXIGE_CONFIRMACAO', pessoas: ['conj', 'conj2'] }));
    });
});

describe('regime de casamento sem cônjuge cadastrado', () => {
    it('comunhão parcial sem cônjuge: sem meação, aviso de atenção (pode ser viúvo), sem trava', () => {
        const r = calculatePartition(caso({ deceased: { maritalRegime: 'COMUNHAO_PARCIAL' }, heirs: doisFilhos, assets: [bem('c', 1_000_000, { origin: 'COMUM' })] }));
        expect(r.totalMeacao).toBe(0);
        expect(aviso(r, 'REGIME_SEM_CONJUGE_CADASTRADO')?.gravidade).toBe('ATENCAO');
        expect(r.minuta.exigeConfirmacao).toBe(false);
    });
});

describe('caso coerente', () => {
    it('comunhão parcial com cônjuge cadastrado: nenhum desses avisos', () => {
        const r = calculatePartition(
            caso({ deceased: { maritalRegime: 'COMUNHAO_PARCIAL', spouseName: 'Cônjuge' }, heirs: [conjuge, ...doisFilhos], assets: [bem('c', 1_000_000, { origin: 'COMUM' })] })
        );
        const codigos = ['CONJUGE_SEM_REGIME_DE_BENS', 'CONJUGE_MARCADO_SO_POR_ISSPOUSE', 'MAIS_DE_UM_CONJUGE', 'REGIME_SEM_CONJUGE_CADASTRADO'];
        expect(r.avisos.filter(a => codigos.includes(a.codigo))).toEqual([]);
    });
});
