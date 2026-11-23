import { PartitionResult } from './tipos';

// HASH CANÔNICO DO RESULTADO (revisão de integração, item 6).
//
// O backend grava `resultadoHash` no snapshot e o frontend precisa saber se o número que mostra é
// o mesmo que o servidor gravou. Comparar "alguns campos" deixava passar diferença no resto; aqui
// o resultado inteiro vira uma string canônica e o sha256 dela. Roda igual em Node e no navegador:
// o sha256 é implementado em TypeScript puro (sem `crypto` do Node nem `SubtleCrypto`, que é
// assíncrono), e a codificação UTF-8 é feita à mão.
//
// Serialização canônica:
//   - chaves de objeto em ordem lexicográfica, em todos os níveis;
//   - propriedades `undefined` omitidas (como no JSON); `-0` vira `0`; não finito vira `null`;
//   - `targets` ordenado por `personId` — é o único array cuja ordem segue a entrada (a tela recebe
//     os alvos na ordem em que mandou os herdeiros); todo o resto o motor já devolve em ordem
//     determinística.

const canonizar = (valor: unknown): unknown => {
    if (typeof valor === 'number') {
        if (!Number.isFinite(valor)) return null;
        return Object.is(valor, -0) ? 0 : valor;
    }
    if (Array.isArray(valor)) return valor.map(canonizar);
    if (valor && typeof valor === 'object') {
        const saida: Record<string, unknown> = {};
        Object.keys(valor as Record<string, unknown>)
            .sort()
            .forEach(chave => {
                const v = (valor as Record<string, unknown>)[chave];
                if (v !== undefined) saida[chave] = canonizar(v);
            });
        return saida;
    }
    return valor;
};

/** String canônica do resultado (ver regras acima). É ela que entra no hash. */
export const serializarResultadoCanonico = (resultado: PartitionResult): string => {
    const targets = [...(resultado.targets || [])].sort((a, b) => (a.personId < b.personId ? -1 : a.personId > b.personId ? 1 : 0));
    return JSON.stringify(canonizar({ ...resultado, targets }));
};

// ------------------------------------------------------------------ SHA-256 (FIPS 180-4)

const K = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01,
    0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc,
    0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147,
    0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070, 0x19a4c116, 0x1e376c08,
    0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
    0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
];

/** Texto → bytes UTF-8, sem depender de TextEncoder. */
const utf8 = (texto: string): number[] => {
    const bytes: number[] = [];
    for (let i = 0; i < texto.length; i++) {
        let c = texto.charCodeAt(i);
        if (c >= 0xd800 && c <= 0xdbff && i + 1 < texto.length) {
            const d = texto.charCodeAt(i + 1);
            if (d >= 0xdc00 && d <= 0xdfff) {
                c = 0x10000 + ((c - 0xd800) << 10) + (d - 0xdc00);
                i++;
            }
        }
        if (c < 0x80) bytes.push(c);
        else if (c < 0x800) bytes.push(0xc0 | (c >> 6), 0x80 | (c & 0x3f));
        else if (c < 0x10000) bytes.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 0x3f), 0x80 | (c & 0x3f));
        else bytes.push(0xf0 | (c >> 18), 0x80 | ((c >> 12) & 0x3f), 0x80 | ((c >> 6) & 0x3f), 0x80 | (c & 0x3f));
    }
    return bytes;
};

const rotr = (x: number, n: number) => (x >>> n) | (x << (32 - n));

/** sha256 em hexadecimal (minúsculo) do texto codificado em UTF-8. */
export const sha256Hex = (texto: string): string => {
    const bytes = utf8(texto);
    const bits = bytes.length * 8;
    bytes.push(0x80);
    while (bytes.length % 64 !== 56) bytes.push(0);
    // Comprimento em bits, 64 bits big-endian (a parte alta cobre textos acima de 512 MB).
    const alto = Math.floor(bits / 0x100000000);
    const baixo = bits >>> 0;
    bytes.push((alto >>> 24) & 0xff, (alto >>> 16) & 0xff, (alto >>> 8) & 0xff, alto & 0xff);
    bytes.push((baixo >>> 24) & 0xff, (baixo >>> 16) & 0xff, (baixo >>> 8) & 0xff, baixo & 0xff);

    const h = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
    const w = new Array<number>(64);
    for (let bloco = 0; bloco < bytes.length; bloco += 64) {
        for (let t = 0; t < 16; t++) {
            const i = bloco + t * 4;
            w[t] = ((bytes[i] << 24) | (bytes[i + 1] << 16) | (bytes[i + 2] << 8) | bytes[i + 3]) | 0;
        }
        for (let t = 16; t < 64; t++) {
            const s0 = rotr(w[t - 15], 7) ^ rotr(w[t - 15], 18) ^ (w[t - 15] >>> 3);
            const s1 = rotr(w[t - 2], 17) ^ rotr(w[t - 2], 19) ^ (w[t - 2] >>> 10);
            w[t] = (w[t - 16] + s0 + w[t - 7] + s1) | 0;
        }
        let [a, b, c, d, e, f, g, hh] = h;
        for (let t = 0; t < 64; t++) {
            const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
            const ch = (e & f) ^ (~e & g);
            const t1 = (hh + S1 + ch + K[t] + w[t]) | 0;
            const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
            const maj = (a & b) ^ (a & c) ^ (b & c);
            const t2 = (S0 + maj) | 0;
            hh = g;
            g = f;
            f = e;
            e = (d + t1) | 0;
            d = c;
            c = b;
            b = a;
            a = (t1 + t2) | 0;
        }
        h[0] = (h[0] + a) | 0;
        h[1] = (h[1] + b) | 0;
        h[2] = (h[2] + c) | 0;
        h[3] = (h[3] + d) | 0;
        h[4] = (h[4] + e) | 0;
        h[5] = (h[5] + f) | 0;
        h[6] = (h[6] + g) | 0;
        h[7] = (h[7] + hh) | 0;
    }
    return h.map(x => (x >>> 0).toString(16).padStart(8, '0')).join('');
};

/**
 * Hash canônico do resultado: `sha256Hex(serializarResultadoCanonico(resultado))`. É o valor que o
 * backend grava como `resultadoHash` e que o frontend compara com o do cálculo que exibe.
 */
export const hashDoResultado = (resultado: PartitionResult): string => sha256Hex(serializarResultadoCanonico(resultado));
