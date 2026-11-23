/**
 * Aritmética monetária em centavos inteiros (CALC-08).
 *
 * Portado de `partilhamais-backend/src/lib/money.ts`, que existia mas não era usado pelo motor:
 * a minuta somava 7 × R$ 14.285,72 = R$ 100.000,04 para um monte de R$ 100.000,01 e o ITCD
 * saía como 4000,0004. Aqui fica só o que o motor de partilha precisa.
 *
 * Por que não `Math.round(valor * 100)`: `2126265.145 * 100` vale 212626514.49999997 em ponto
 * flutuante, e o arredondamento devolve R$ 2.126.265,14 onde a praxe fiscal manda
 * R$ 2.126.265,15. A conversão é feita sobre a REPRESENTAÇÃO DECIMAL do valor (a mesma que
 * `String(x)` imprime), nunca sobre o binário, e o empate afasta-se do zero (ROUND_HALF_UP).
 */

const DECIMAL_PATTERN = /^([+-]?)(\d*)(?:\.(\d*))?(?:[eE]([+-]?\d+))?$/;

interface DecimalParts {
    negative: boolean;
    digits: string;
    scale: number;
}

const parseDecimal = (input: number | string | null | undefined): DecimalParts | null => {
    if (input === null || input === undefined) return null;
    if (typeof input === 'number' && !Number.isFinite(input)) return null;

    const text = String(input).trim();
    if (text === '') return null;

    const match = DECIMAL_PATTERN.exec(text);
    if (!match) return null;

    const [, sign, intRaw, fracRaw = '', expRaw] = match;
    if (intRaw === '' && fracRaw === '') return null;

    let digits = `${intRaw}${fracRaw}`;
    let scale = fracRaw.length;
    const exponent = expRaw ? Number(expRaw) : 0;
    if (exponent > 0) {
        const consumed = Math.min(exponent, scale);
        scale -= consumed;
        digits += '0'.repeat(exponent - consumed);
    } else if (exponent < 0) {
        scale += -exponent;
    }

    const trimmed = digits.replace(/^0+(?=\d)/, '');
    return { negative: sign === '-' && /[1-9]/.test(trimmed), digits: trimmed, scale };
};

/** Reescala para centavos, meio-para-cima, sem passar pelo binário. */
const rescaleToCents = (parts: DecimalParts): number => {
    const { negative, digits, scale } = parts;
    let cents: number;
    if (scale <= 2) {
        cents = Number(digits || '0') * 10 ** (2 - scale);
    } else {
        // Corta a parte além do centavo como TEXTO e decide o arredondamento pelo primeiro
        // dígito descartado: é a regra ROUND_HALF_UP aplicada ao decimal que o usuário vê.
        const padded = digits.padStart(scale + 1, '0');
        const kept = padded.slice(0, padded.length - (scale - 2));
        const firstDropped = Number(padded.charAt(padded.length - (scale - 2)));
        cents = Number(kept || '0') + (firstDropped >= 5 ? 1 : 0);
    }
    return negative ? -cents : cents;
};

/** Valor monetário em centavos inteiros, meio-para-cima. Base de toda soma e todo rateio. */
export const toCents = (value: number | string | null | undefined): number => {
    const parts = parseDecimal(value);
    if (!parts) return 0;
    return rescaleToCents(parts);
};

/** Centavos de volta para reais. Só no limite da saída. */
export const fromCents = (cents: number): number => Math.round(cents) / 100;

/** Arredonda um valor em reais para centavos, meio-para-cima. */
export const roundMoney = (value: number | string | null | undefined): number => fromCents(toCents(value));

/**
 * Rateia `totalCents` entre `weights` pelo método do maior resto: a soma das partes é IGUAL
 * ao total, sempre. Peso zero recebe zero; peso negativo é tratado como zero (nenhum rateio
 * do motor tem parte negativa, e aceitar uma devolveria centavo a quem não tem quinhão).
 */
export const distributeCents = (totalCents: number, weights: number[]): number[] => {
    const total = Math.round(totalCents);
    if (weights.length === 0) return [];

    const safeWeights = weights.map(w => (Number.isFinite(w) && w > 0 ? w : 0));
    const weightSum = safeWeights.reduce((sum, w) => sum + w, 0);
    if (weightSum <= 0) return weights.map(() => 0);

    const exact = safeWeights.map(w => (total * w) / weightSum);
    const floors = exact.map(v => Math.floor(v));
    let remaining = total - floors.reduce((sum, v) => sum + v, 0);

    // Desempate estável pelo índice: o mesmo rateio devolve sempre a mesma distribuição.
    const order = exact
        .map((v, index) => ({ index, remainder: v - floors[index], weight: safeWeights[index] }))
        .filter(item => item.weight > 0)
        .sort((a, b) => b.remainder - a.remainder || a.index - b.index);

    const result = [...floors];
    for (let i = 0; remaining > 0 && order.length > 0; i = (i + 1) % order.length, remaining--) {
        result[order[i].index] += 1;
    }
    for (let i = order.length - 1; remaining < 0 && order.length > 0; i = (i - 1 + order.length) % order.length, remaining++) {
        result[order[i].index] -= 1;
    }
    return result;
};

/** Igualdade monetária ao centavo — substitui `a === b` entre doubles. */
export const moneyEquals = (a: number, b: number): boolean => toCents(a) === toCents(b);

/** Fração p/q (q > 0, mdc = 1). */
export interface FracaoRazao {
    numerador: number;
    denominador: number;
    /** "1/7", ou "1" quando a fração é o inteiro. */
    texto: string;
}

const mdc = (a: number, b: number): number => (b === 0 ? Math.abs(a) : mdc(b, a % b));

/**
 * Fração exata como razão (CALC-08): "1/7" em vez de "14,2857%". Usa frações contínuas com
 * denominador limitado e só devolve a razão quando ela reproduz o número com erro de
 * arredondamento binário — quinhão que depende de valor (concorrência do cônjuge só nos
 * particulares, legado em reais) não tem razão pequena e volta `null`, para que a tela
 * mostre o percentual em vez de uma fração inventada.
 */
export const toFraction = (value: number, maxDenominator = 10_000, tolerance = 1e-9): FracaoRazao | null => {
    if (!Number.isFinite(value) || value < 0) return null;
    if (value === 0) return { numerador: 0, denominador: 1, texto: '0' };

    let [h0, h1] = [0, 1];
    let [k0, k1] = [1, 0];
    let x = value;
    for (let i = 0; i < 64; i++) {
        const a = Math.floor(x);
        const h2 = a * h1 + h0;
        const k2 = a * k1 + k0;
        if (k2 > maxDenominator) break;
        [h0, h1] = [h1, h2];
        [k0, k1] = [k1, k2];
        if (Math.abs(value - h1 / k1) <= tolerance) {
            const divisor = mdc(h1, k1) || 1;
            const numerador = h1 / divisor;
            const denominador = k1 / divisor;
            return { numerador, denominador, texto: denominador === 1 ? `${numerador}` : `${numerador}/${denominador}` };
        }
        const frac = x - a;
        if (frac < 1e-15) break;
        x = 1 / frac;
    }
    return null;
};
