// Leitura dos arquivos de vetores dourados dentro do teste.
//
// Por que `require` e não `import`: o pacote não declara `@types/node` — nenhum código de
// produção toca em API de Node — e acrescentar a dependência exigiria regerar o
// package-lock, que o CI valida com `npm ci`. As assinaturas abaixo são locais a este
// módulo (não vazam para o escopo global) e cobrem exatamente o que é usado.
//
// Por que não `import cru from './x.jsonl?raw'`: o arquivo do ITCD tem 5 MB e transformá-lo
// num literal de string faz o processo do Vitest estourar a memória do V8 na fase de
// transformação ("Zone Allocation failed"). Lido por `fs` não passa pelo bundler.

import { desserializarVetores, VetorGolden } from './golden.formato';
import { COMANDO_REGERAR, PASTA_GOLDEN } from './golden.caminhos';

interface ModuloFs {
    existsSync(caminho: string): boolean;
    readFileSync(caminho: string, codificacao: 'utf8'): string;
}

interface ModuloPath {
    join(...partes: string[]): string;
}

declare function require(modulo: 'node:fs'): ModuloFs;
declare function require(modulo: 'node:path'): ModuloPath;
declare const __dirname: string;

export const lerVetoresCongelados = (nomeDoArquivo: string): VetorGolden[] => {
    const fs = require('node:fs');
    const caminho = require('node:path').join(__dirname, nomeDoArquivo);

    if (!fs.existsSync(caminho)) {
        throw new Error(
            `Arquivo de vetores dourados ausente: ${PASTA_GOLDEN}/${nomeDoArquivo}. ` +
                `Gere com \`${COMANDO_REGERAR}\` — sem ele nada prova que o motor não mudou.`
        );
    }

    return desserializarVetores(fs.readFileSync(caminho, 'utf8'));
};
