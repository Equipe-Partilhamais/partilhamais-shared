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
/** Valor monetário em centavos inteiros, meio-para-cima. Base de toda soma e todo rateio. */
export declare const toCents: (value: number | string | null | undefined) => number;
/** Centavos de volta para reais. Só no limite da saída. */
export declare const fromCents: (cents: number) => number;
/** Arredonda um valor em reais para centavos, meio-para-cima. */
export declare const roundMoney: (value: number | string | null | undefined) => number;
/**
 * Rateia `totalCents` entre `weights` pelo método do maior resto: a soma das partes é IGUAL
 * ao total, sempre. Peso zero recebe zero; peso negativo é tratado como zero (nenhum rateio
 * do motor tem parte negativa, e aceitar uma devolveria centavo a quem não tem quinhão).
 */
export declare const distributeCents: (totalCents: number, weights: number[]) => number[];
/** Igualdade monetária ao centavo — substitui `a === b` entre doubles. */
export declare const moneyEquals: (a: number, b: number) => boolean;
/** Fração p/q (q > 0, mdc = 1). */
export interface FracaoRazao {
    numerador: number;
    denominador: number;
    /** "1/7", ou "1" quando a fração é o inteiro. */
    texto: string;
}
/**
 * Fração exata como razão (CALC-08): "1/7" em vez de "14,2857%". Usa frações contínuas com
 * denominador limitado e só devolve a razão quando ela reproduz o número com erro de
 * arredondamento binário — quinhão que depende de valor (concorrência do cônjuge só nos
 * particulares, legado em reais) não tem razão pequena e volta `null`, para que a tela
 * mostre o percentual em vez de uma fração inventada.
 */
export declare const toFraction: (value: number, maxDenominator?: number, tolerance?: number) => FracaoRazao | null;
