// Gera os VETORES DOURADOS do ITCD.
//
// Percorre a matriz completa (27 UFs × causa mortis/doação × bases nos cortes de faixa e nas
// bases degeneradas × datas de fato gerador × flag de desconto), grava um vetor por linha e
// CONFERE OS INVARIANTES antes de gravar.
//
// Invariante violado não vira vetor congelado em silêncio: o gerador imprime a violação e sai
// com código 2. Congelar um número que não fecha transformaria um defeito em contrato.
//
//     npm run golden:gerar          (gera ITCD + sucessório)
//     npx vite-node scripts/gerar-golden-itcd.ts
//     npx vite-node scripts/gerar-golden-itcd.ts --permitir-invariante-violado
//
// A última forma existe para o caso em que a violação é conhecida, já está registrada e o
// congelamento é deliberado — nunca como atalho para calar o gerador.

import {
    combinacoesItcd,
    descreverCombinacaoItcd,
    DATAS_FATO_GERADOR,
    DESCONTOS,
    gerarVetoresItcd,
    TIPOS,
    UFS,
    violacoesDeInvarianteItcd,
} from '../src/__tests__/golden.matriz.itcd';
import { ARQUIVO_GOLDEN_ITCD } from '../src/__tests__/golden.caminhos';
import { cabecalhoPadrao, gravarVetores } from './golden-io';

const MAX_VIOLACOES_IMPRESSAS = 40;

const main = (): void => {
    const permitirViolacao = process.argv.includes('--permitir-invariante-violado');

    const combinacoes = combinacoesItcd();
    const vetores = gerarVetoresItcd();

    const violacoes = vetores.flatMap(violacoesDeInvarianteItcd);

    if (violacoes.length > 0) {
        const porInvariante = new Map<string, number>();
        violacoes.forEach(v => porInvariante.set(v.invariante, (porInvariante.get(v.invariante) || 0) + 1));

        console.error('');
        console.error(`ACHADO — ${violacoes.length} violação(ões) de invariante em ${vetores.length} vetores:`);
        porInvariante.forEach((quantidade, invariante) =>
            console.error(`  · ${invariante}: ${quantidade} caso(s)`)
        );
        console.error('');
        violacoes.slice(0, MAX_VIOLACOES_IMPRESSAS).forEach(v => {
            console.error(`  » ${descreverCombinacaoItcd(v.id)}`);
            console.error(`      invariante: ${v.invariante}`);
            console.error(`      ${v.detalhe}`);
        });
        if (violacoes.length > MAX_VIOLACOES_IMPRESSAS) {
            console.error(`  ... e mais ${violacoes.length - MAX_VIOLACOES_IMPRESSAS}.`);
        }
        console.error('');

        if (!permitirViolacao) {
            console.error(
                'Nada foi gravado. Corrija o motor, ou registre a violação e rode de novo com ' +
                    '--permitir-invariante-violado se o congelamento for deliberado.'
            );
            process.exit(2);
        }
        console.error('--permitir-invariante-violado: gravando mesmo assim.');
    }

    const resultado = gravarVetores(
        ARQUIVO_GOLDEN_ITCD,
        vetores,
        cabecalhoPadrao('VETORES DOURADOS — ITCD (calculateItcdForState)', [
            `${vetores.length} vetores = ${UFS.length} UFs × ${TIPOS.length} tipos de fato gerador × ` +
                `bases da UF × ${DATAS_FATO_GERADOR.length} datas × ${DESCONTOS.length} estados da flag de desconto.`,
            'Bases: cada corte de faixa da UF, o corte −0,01 e o corte +0,01, mais 0 / 0,01 / 1 / ' +
                'R$ 100.000 / R$ 1.000.000 / R$ 10.000.000 / R$ 50.000.000.',
            `Invariantes conferidos na geração: ${violacoes.length === 0 ? 'todos passaram' : `${violacoes.length} VIOLADO(S)`}.`,
        ])
    );

    console.log(`ITCD: ${resultado.quantidade} vetores (${combinacoes.length} combinações) gravados em`);
    console.log(`  ${resultado.caminho}  (${(resultado.bytes / 1024 / 1024).toFixed(2)} MB)`);
    console.log(`  invariantes: ${violacoes.length === 0 ? 'OK' : `${violacoes.length} violação(ões)`}`);
};

main();
