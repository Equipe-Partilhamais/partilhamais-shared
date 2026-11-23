import { describe, expect, it } from 'vitest';
import { calculatePartition } from '../services/partilha/motor';
import { CENARIOS, Cenario, Contra, MudancaDeclarada } from './caracterizacao/cenarios';
import { calculatePartition as motorLegadoFrontend } from './caracterizacao/legado/frontend.calculationService';
import { calculatePartition as motorLegadoBackend } from './caracterizacao/legado/backend.calculationService';
import { NOTARY_TABLES, TABLE_METADATA } from './caracterizacao/legado/backend.notaryFees';
import { compararProjecoes, descreverDiferencas, Diferenca, projetar } from './caracterizacao/projecao';

// CARACTERIZAÇÃO DO MOTOR ÚNICO (CALC-09).
//
// Roda cada cenário nos DOIS motores que existiam (cópia congelada em `caracterizacao/legado/`)
// e no motor unificado do shared, e compara número a número. Passa só quando:
//   1. toda diferença entre o unificado e um legado está DECLARADA no cenário, com o motivo
//      (correção intencional — CALC-01 a CALC-08 — ou reconciliação front × back); e
//   2. toda declaração corresponde a uma diferença que de fato existe.
// A segunda condição impede a lista de mudanças de virar texto morto: quem corrigir de novo um
// número sem atualizar o motivo, ou declarar uma mudança que não aconteceu, reprova aqui.

/**
 * Reconciliações que valem para TODOS os cenários contra o motor do backend: são campos que o
 * backend simplesmente não produzia. Ficam aqui, uma vez, em vez de repetidas em cada cenário.
 */
const RECONCILIACOES_GLOBAIS_BACKEND: MudancaDeclarada[] = [
    {
        caminho: /^itcd\[[A-Z]{2}\]\.regras$/,
        motivo: 'o backend não devolvia as regras de competência no ITCD; vale o frontend.',
    },
];

const verificar = (cenario: Cenario, diferencas: Diferenca[], declaradas: MudancaDeclarada[], rotulo: string) => {
    const naoDeclaradas = diferencas.filter(d => !declaradas.some(m => m.caminho.test(d.caminho)));
    const mortas = declaradas.filter(m => !diferencas.some(d => m.caminho.test(d.caminho)));

    const partes: string[] = [];
    if (naoDeclaradas.length > 0) {
        partes.push(`  diferenças NÃO declaradas (${rotulo}):\n${descreverDiferencas(naoDeclaradas)}`);
    }
    if (mortas.length > 0) {
        partes.push(`  declarações sem diferença correspondente (${rotulo}):\n${mortas.map(m => `      ${m.caminho} — ${m.motivo}`).join('\n')}`);
    }
    if (partes.length > 0) {
        throw new Error(`Cenário "${cenario.id}" (${cenario.descricao}):\n${partes.join('\n')}`);
    }
};

const declaradasContra = (cenario: Cenario, alvo: Exclude<Contra, 'AMBOS'>): MudancaDeclarada[] =>
    (cenario.mudancas || []).filter(m => (m.contra ?? 'AMBOS') === 'AMBOS' || m.contra === alvo);

describe('caracterização — motor unificado × motores legados do front e do back', () => {
    it('cobre os cenários dos dois apps e os dos cartões CALC', () => {
        expect(CENARIOS.length).toBeGreaterThanOrEqual(40);
        expect(new Set(CENARIOS.map(c => c.id)).size).toBe(CENARIOS.length);
    });

    describe.each(CENARIOS.map(c => [c.id, c] as const))('%s', (_id, cenario) => {
        it('unificado × legado do FRONTEND', () => {
            const legado = projetar(motorLegadoFrontend(cenario.entrada));
            const unificado = projetar(calculatePartition(cenario.entrada));
            verificar(cenario, compararProjecoes(legado, unificado), declaradasContra(cenario, 'FRONT'), 'contra o frontend');
        });

        it('unificado × legado do BACKEND (com as tabelas de emolumentos do backend)', () => {
            const legado = projetar(motorLegadoBackend(cenario.entrada));
            const unificado = projetar(
                calculatePartition({ ...cenario.entrada, feeTables: NOTARY_TABLES, feeMetadata: TABLE_METADATA })
            );
            const declaradas = [
                ...declaradasContra(cenario, 'BACK'),
                ...(cenario.divergenciaLegada || []).filter(d => !d.soEntreLegados),
            ];
            const diferencas = compararProjecoes(legado, unificado, caminho =>
                RECONCILIACOES_GLOBAIS_BACKEND.some(r => r.caminho.test(caminho))
            );
            verificar(cenario, diferencas, declaradas, 'contra o backend');
        });

        it('a divergência entre os dois legados está documentada', () => {
            const front = projetar(motorLegadoFrontend(cenario.entrada));
            const back = projetar(motorLegadoBackend(cenario.entrada));
            const diferencas = compararProjecoes(front, back, caminho =>
                RECONCILIACOES_GLOBAIS_BACKEND.some(r => r.caminho.test(caminho))
            );
            verificar(cenario, diferencas, cenario.divergenciaLegada || [], 'frontend × backend legados');
        });
    });
});
