// Onde ficam os arquivos de vetores dourados.
//
// O nome do arquivo é usado pelo teste (que lê pelo diretório dele) e o caminho a partir da
// raiz é usado pelo gerador (que roda a partir da raiz do pacote). Ficam juntos para que
// mover um arquivo não deixe as duas pontas apontando para lugares diferentes.

export const PASTA_GOLDEN = 'src/__tests__';

export const NOME_GOLDEN_ITCD = 'golden.itcd.vetores.jsonl';
export const NOME_GOLDEN_SUCESSAO = 'golden.sucessao.vetores.jsonl';

export const ARQUIVO_GOLDEN_ITCD = `${PASTA_GOLDEN}/${NOME_GOLDEN_ITCD}`;
export const ARQUIVO_GOLDEN_SUCESSAO = `${PASTA_GOLDEN}/${NOME_GOLDEN_SUCESSAO}`;

export const COMANDO_REGERAR = 'npm run golden:gerar';
