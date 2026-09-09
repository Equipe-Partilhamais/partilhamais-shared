// Gera os VETORES DOURADOS do núcleo sucessório (`successionCore`).
//
// Congela os quinhões resultantes de cada cenário de vocação hereditária — cônjuge por
// regime, descendentes em várias estirpes, ascendentes por grau e linha, colaterais,
// renúncia, testamento (redução por inoficiosidade) e rateio de passivo por UF.
//
// Igual ao gerador do ITCD: invariante violado (a soma dos quinhões não fechar com o monte,
// um pré-morto receber quinhão) interrompe a gravação em vez de virar contrato.
//
//     npm run golden:gerar
//     npx vite-node scripts/gerar-golden-sucessao.ts

import {
    descreverCenarioSucessao,
    gerarVetoresSucessao,
    MONTE,
    violacoesDeInvarianteSucessao,
    violacoesDePesoDeEstirpe,
} from '../src/__tests__/golden.matriz.sucessao';
import { ARQUIVO_GOLDEN_SUCESSAO } from '../src/__tests__/golden.caminhos';
import { cabecalhoPadrao, gravarVetores } from './golden-io';
import { formatCurrency } from '../src/utils/formatters';

const main = (): void => {
    const permitirViolacao = process.argv.includes('--permitir-invariante-violado');

    const vetores = gerarVetoresSucessao();
    const violacoes = [...violacoesDeInvarianteSucessao(), ...violacoesDePesoDeEstirpe()];

    if (violacoes.length > 0) {
        console.error('');
        console.error(`ACHADO — ${violacoes.length} violação(ões) de invariante em ${vetores.length} vetores:`);
        violacoes.forEach(v => {
            console.error(`  » ${descreverCenarioSucessao(v.id)}`);
            console.error(`      invariante: ${v.invariante}`);
            console.error(`      ${v.detalhe}`);
        });
        console.error('');

        if (!permitirViolacao) {
            console.error('Nada foi gravado. Corrija o núcleo sucessório antes de congelar estes quinhões.');
            process.exit(2);
        }
        console.error('--permitir-invariante-violado: gravando mesmo assim.');
    }

    const resultado = gravarVetores(
        ARQUIVO_GOLDEN_SUCESSAO,
        vetores,
        cabecalhoPadrao('VETORES DOURADOS — núcleo sucessório (successionCore)', [
            `${vetores.length} cenários. Monte partilhável de referência: ${formatCurrency(MONTE)}.`,
            'Grupos: REGIME, DESCENDENTES, ASCENDENTES, COLATERAIS, TESTAMENTO, PASSIVO, CONTRATO.',
            `Invariantes conferidos na geração: ${violacoes.length === 0 ? 'todos passaram' : `${violacoes.length} VIOLADO(S)`}.`,
        ])
    );

    console.log(`Sucessório: ${resultado.quantidade} vetores gravados em`);
    console.log(`  ${resultado.caminho}  (${(resultado.bytes / 1024).toFixed(1)} KB)`);
    console.log(`  invariantes: ${violacoes.length === 0 ? 'OK' : `${violacoes.length} violação(ões)`}`);
};

main();
