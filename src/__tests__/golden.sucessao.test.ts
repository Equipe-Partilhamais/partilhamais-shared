import { describe, expect, it } from 'vitest';
import { lerVetoresCongelados } from './golden.arquivo';
import { ARQUIVO_GOLDEN_SUCESSAO, COMANDO_REGERAR, NOME_GOLDEN_SUCESSAO } from './golden.caminhos';
import { compararComGolden, relatarGolden } from './golden.formato';
import {
    cenariosSucessao,
    descreverCenarioSucessao,
    gerarVetoresSucessao,
    violacoesDeInvarianteSucessao,
    violacoesDePesoDeEstirpe,
} from './golden.matriz.sucessao';

// REDE DE SEGURANÇA DO NÚCLEO SUCESSÓRIO.
//
// `unificacao.nucleoSucessorio.test.ts` prova que cada regra faz o que a lei diz. Este aqui
// prova outra coisa: que os QUINHÕES não mudaram. São complementares — o primeiro pega a
// regra escrita errado, o segundo pega a regra certa aplicada a um caso que já foi partilhado.

const congelados = lerVetoresCongelados(NOME_GOLDEN_SUCESSAO);

describe('golden sucessório — quinhões congelados', () => {
    it('o arquivo de vetores cobre todos os cenários', () => {
        expect(congelados.length).toBe(cenariosSucessao().length);
        expect(congelados.length).toBeGreaterThan(0);
    });

    it('nenhum cenário mudou de quinhão', () => {
        const obtidos = gerarVetoresSucessao();
        const relatorio = relatarGolden(
            'golden sucessório',
            compararComGolden(congelados, obtidos),
            obtidos.length,
            descreverCenarioSucessao,
            COMANDO_REGERAR
        );

        if (relatorio) throw new Error(`${relatorio}\n\nArquivo: ${ARQUIVO_GOLDEN_SUCESSAO}`);
    });

    it('a soma dos quinhões fecha com o monte em todos os cenários', () => {
        const violacoes = [...violacoesDeInvarianteSucessao(), ...violacoesDePesoDeEstirpe()];

        if (violacoes.length > 0) {
            const detalhe = violacoes
                .map(
                    v =>
                        `  » ${descreverCenarioSucessao(v.id)}\n` +
                        `      invariante: ${v.invariante}\n` +
                        `      ${v.detalhe}`
                )
                .join('\n');
            throw new Error(`${violacoes.length} violação(ões) de invariante no núcleo sucessório:\n${detalhe}`);
        }

        expect(violacoes).toEqual([]);
    });

    it('acusa o cenário exato quando um quinhão muda', () => {
        const obtidos = gerarVetoresSucessao();
        const alvo = obtidos.findIndex(v => v.quinhoes && Object.keys(v.quinhoes).length > 0);
        expect(alvo).toBeGreaterThanOrEqual(0);

        const quinhoes = obtidos[alvo].quinhoes as { [id: string]: number };
        const primeiro = Object.keys(quinhoes)[0];
        const adulterados = obtidos.map((vetor, indice) =>
            indice === alvo
                ? { ...vetor, quinhoes: { ...quinhoes, [primeiro]: quinhoes[primeiro] + 0.01 } }
                : vetor
        );

        const relatorio = relatarGolden(
            'golden sucessório',
            compararComGolden(congelados, adulterados),
            adulterados.length,
            descreverCenarioSucessao,
            COMANDO_REGERAR
        );

        expect(relatorio).not.toBeNull();
        expect(relatorio).toContain(descreverCenarioSucessao(obtidos[alvo].id as string));
        expect(relatorio).toContain(`quinhoes.${primeiro}`);
    });
});
