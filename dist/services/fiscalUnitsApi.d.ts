export interface FiscalUnitVigencia {
    /** Início da vigência do valor, em AAAA-MM-DD. */
    vigenciaInicio: string;
    value: number;
    source: string;
    /**
     * O valor foi conferido na SEFAZ estadual por um responsável identificado?
     * Cobrir a data do fato gerador NÃO é o mesmo que estar conferido: o ponto de Jan/2025
     * é referencial, e o enquadramento por faixa depende dele (no RJ, a UFIR define se a
     * base cai em 6% ou 8%). Enquanto for `false`, o cálculo sai com ressalva.
     */
    conferida: boolean;
}
export interface FiscalUnit {
    id: string;
    name: string;
    value: number;
    vigenciaInicio: string;
    source: string;
    description: string;
    /**
     * true quando a série não cobre a data consultada e o valor devolvido é apenas o último
     * conhecido. Quem exibe o cálculo precisa ressalvar — o número está desatualizado.
     */
    outdated: boolean;
    /** false enquanto ninguém conferiu o índice na SEFAZ estadual. Independe de `outdated`. */
    conferida: boolean;
}
export declare const fiscalUnitsApi: {
    /**
     * Valor da unidade fiscal da UF vigente na data informada (data do óbito/doação).
     * Sem `referenceDate` devolve o último ponto conhecido, já marcado como `outdated`.
     */
    getUnit: (uf: string, referenceDate?: string) => FiscalUnit | null;
    /**
     * Igual a `getUnit`, mas nunca devolve null: se a UF não tiver série cadastrada, entrega o
     * fallback já carimbado como desatualizado, para o cálculo não silenciar a ausência de dado.
     */
    requireUnit: (uf: string, fallback: {
        id: string;
        name: string;
        value: number;
    }, referenceDate?: string) => FiscalUnit;
    getAllUnits: (referenceDate?: string) => FiscalUnit[];
    /** Séries cuja última vigência conhecida é anterior ao ano informado — insumo externo pendente. */
    listSeriesPendentes: (year: number) => {
        uf: string;
        name: string;
        ultimaVigencia: string;
    }[];
};
