import { describe, expect, it } from 'vitest';
import { lerVetoresCongelados } from './golden.arquivo';
import { ARQUIVO_GOLDEN_ITCD, COMANDO_REGERAR, NOME_GOLDEN_ITCD } from './golden.caminhos';
import { compararComGolden, relatarGolden } from './golden.formato';
import {
    combinacoesItcd,
    descreverCombinacaoItcd,
    gerarVetoresItcd,
    violacoesDeInvarianteItcd,
} from './golden.matriz.itcd';

// REDE DE SEGURANÇA DO MOTOR DE ITCD.
//
// Não afirma que o imposto está CERTO — nenhuma UF foi homologada ainda. Afirma que ele é o
// MESMO que já foi entregue a cliente. Qualquer mudança no motor que mova um centavo em
// qualquer combinação da matriz aparece aqui, com o nome da combinação e o valor antes e
// depois. Se a mudança for intencional, regere os vetores e revise o diff do arquivo.
//
// A comparação é ESTRITA (`===`), não aproximada: um `toBeCloseTo` deixaria passar
// exatamente a diferença de centavo que esta suíte existe para pegar.

const congelados = lerVetoresCongelados(NOME_GOLDEN_ITCD);

describe('golden ITCD — vetores congelados', () => {
    it('o arquivo de vetores cobre a matriz inteira', () => {
        expect(congelados.length).toBe(combinacoesItcd().length);
        expect(congelados.length).toBeGreaterThan(0);
    });

    it('nenhuma combinação da matriz mudou de valor', () => {
        const obtidos = gerarVetoresItcd();
        const relatorio = relatarGolden(
            'golden ITCD',
            compararComGolden(congelados, obtidos),
            obtidos.length,
            descreverCombinacaoItcd,
            COMANDO_REGERAR
        );

        if (relatorio) throw new Error(`${relatorio}\n\nArquivo: ${ARQUIVO_GOLDEN_ITCD}`);
    });

    // O vetor congela o comportamento atual, certo ou errado — este teste é o que separa os
    // dois. Um resultado cuja memória de cálculo não soma o imposto devido é defeito, e
    // congelá-lo em silêncio o transformaria em contrato.
    it('a soma das partes fecha com o total em todos os vetores', () => {
        const violacoes = gerarVetoresItcd().flatMap(violacoesDeInvarianteItcd);

        if (violacoes.length > 0) {
            const detalhe = violacoes
                .slice(0, 20)
                .map(
                    v =>
                        `  » ${descreverCombinacaoItcd(v.id)}\n` +
                        `      invariante: ${v.invariante}\n` +
                        `      ${v.detalhe}`
                )
                .join('\n');
            throw new Error(
                `${violacoes.length} violação(ões) de invariante no motor de ITCD ` +
                    `(não é diferença contra o vetor: é o número não fechando consigo mesmo):\n${detalhe}` +
                    (violacoes.length > 20 ? `\n  ... e mais ${violacoes.length - 20}.` : '')
            );
        }

        expect(violacoes).toEqual([]);
    });

    // Um golden que compara o arquivo consigo mesmo passaria para sempre. Estes dois casos
    // provam que a comparação realmente falha quando um centavo se move.
    it('acusa a combinação exata quando um centavo muda', () => {
        const obtidos = gerarVetoresItcd();
        const alvo = obtidos.findIndex(v => (v.imposto as number) > 0);
        expect(alvo).toBeGreaterThanOrEqual(0);

        const adulterados = obtidos.map((vetor, indice) =>
            indice === alvo ? { ...vetor, imposto: (vetor.imposto as number) + 0.01 } : vetor
        );

        const relatorio = relatarGolden(
            'golden ITCD',
            compararComGolden(congelados, adulterados),
            adulterados.length,
            descreverCombinacaoItcd,
            COMANDO_REGERAR
        );

        expect(relatorio).not.toBeNull();
        expect(relatorio).toContain(descreverCombinacaoItcd(obtidos[alvo].id as string));
        expect(relatorio).toContain('campo     imposto');
        expect(relatorio).toContain('diferença +');
    });

    it('acusa combinação que sumiu e combinação que apareceu', () => {
        const obtidos = gerarVetoresItcd();
        const semUm = obtidos.slice(1);
        const relatorio = relatarGolden(
            'golden ITCD',
            compararComGolden(congelados, semUm),
            semUm.length,
            descreverCombinacaoItcd,
            COMANDO_REGERAR
        );

        expect(relatorio).toContain('não são mais gerados pela matriz');
        expect(relatorio).toContain(descreverCombinacaoItcd(obtidos[0].id as string));
    });
});
