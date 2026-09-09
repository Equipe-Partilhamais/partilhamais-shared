// Tipos mínimos de Node usados pelos geradores.
//
// O pacote NÃO declara `@types/node`: nenhum código de produção toca em API de Node, e
// acrescentar a dependência exigiria regerar o package-lock (o CI roda `npm ci`, que falha
// se os dois discordarem). Estas declarações valem só para `scripts/`, que tem o seu próprio
// tsconfig e não é compilado para `dist/`.

declare module 'node:fs' {
    export function existsSync(caminho: string): boolean;
    export function mkdirSync(caminho: string, opcoes?: { recursive?: boolean }): void;
    export function readFileSync(caminho: string, codificacao: 'utf8'): string;
    export function writeFileSync(caminho: string, dados: string, codificacao: 'utf8'): void;
}

declare module 'node:path' {
    export function join(...partes: string[]): string;
    export function dirname(caminho: string): string;
}

declare const process: {
    cwd(): string;
    argv: string[];
    exit(codigo?: number): never;
    stdout: { write(texto: string): void };
};
