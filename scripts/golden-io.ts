// Escrita dos arquivos de vetores dourados. Fica separado do gerador porque os dois
// geradores (ITCD e sucessório) precisam exatamente do mesmo cabeçalho e da mesma conferência
// pós-escrita.
//
// Rodam sob `vite-node` (ver package.json). O pacote não declara `@types/node` de propósito —
// nada em produção usa API de Node — então os tipos usados aqui estão em `tipos-node.d.ts`,
// restrito a esta pasta.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import {
    compararComGolden,
    desserializarVetores,
    relatarGolden,
    serializarVetores,
    VetorGolden,
} from '../src/__tests__/golden.formato';

/**
 * Raiz do pacote. `vite-node` não dá o diretório do arquivo, então o gerador é feito para
 * rodar a partir da raiz (é o que o script do npm faz) e isso é conferido em vez de suposto.
 */
export const raizDoPacote = (): string => {
    const raiz = process.cwd();
    if (!existsSync(join(raiz, 'package.json')) || !existsSync(join(raiz, 'src', '__tests__'))) {
        throw new Error(
            `Rode o gerador a partir da raiz de partilhamais-shared (cwd atual: ${raiz}). ` +
                'Use `npm run golden:gerar`.'
        );
    }
    return raiz;
};

export interface ResultadoGravacao {
    caminho: string;
    quantidade: number;
    bytes: number;
}

export const gravarVetores = (
    caminhoRelativo: string,
    vetores: VetorGolden[],
    cabecalho: string[]
): ResultadoGravacao => {
    const caminho = join(raizDoPacote(), caminhoRelativo);
    mkdirSync(dirname(caminho), { recursive: true });

    const conteudo = serializarVetores(vetores, cabecalho);
    writeFileSync(caminho, conteudo, 'utf8');

    // Relê e recompara: um erro de serialização (número virando string, campo perdido) só
    // apareceria meses depois, na primeira vez que o teste rodasse contra o arquivo.
    const relidos = desserializarVetores(readFileSync(caminho, 'utf8'));
    const problema = relatarGolden(
        `Conferência do arquivo recém-gravado (${caminhoRelativo})`,
        compararComGolden(relidos, vetores),
        vetores.length,
        id => id,
        'npm run golden:gerar'
    );
    if (problema) throw new Error(problema);

    return { caminho, quantidade: vetores.length, bytes: new TextEncoder().encode(conteudo).length };
};

export const cabecalhoPadrao = (titulo: string, detalhes: string[]): string[] => [
    titulo,
    'ARQUIVO GERADO — não edite à mão. Regere com `npm run golden:gerar`.',
    'Um vetor por linha, para que o diff mostre exatamente quais combinações mudaram.',
    ...detalhes,
];
