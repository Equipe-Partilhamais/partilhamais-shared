/**
 * Ritmo de publicação da unidade. MENSAL não é detalhe de cadastro: na UPF/MT e na UFR-PB o
 * índice muda TODO mês, e usar o ponto de outro mês é usar competência errada. Por isso a série
 * mensal só considera coberto o mês que tem vigência própria — ver `resolveVigencia`.
 */
export type FiscalUnitPeriodicidade = 'ANUAL' | 'MENSAL';
export interface FiscalUnitVigencia {
    /** Início da vigência do valor, em AAAA-MM-DD. */
    vigenciaInicio: string;
    value: number;
    source: string;
    /**
     * O valor foi conferido na SEFAZ estadual por um responsável identificado?
     * Levantar a norma em fonte oficial NÃO é conferir: a conferência exige assinatura humana
     * de um advogado do escritório. Enquanto for `false`, o cálculo sai com ressalva.
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
    periodicidade: FiscalUnitPeriodicidade;
    /**
     * true quando a série não cobre a data consultada e o valor devolvido é apenas o último
     * conhecido. Quem exibe o cálculo precisa ressalvar — o número está desatualizado.
     */
    outdated: boolean;
    /**
     * true quando a série é mensal e o mês do fato gerador não tem vigência publicada. O valor
     * vem do mês anterior, o que muda a faixa do imposto; nunca pode passar em silêncio.
     */
    lacunaNaSerie: boolean;
    /** false enquanto ninguém conferiu o índice na SEFAZ estadual. Independe de `outdated`. */
    conferida: boolean;
    /** true quando a UF não tem índice levantado em fonte oficial — não há número para calcular. */
    indiceIndisponivel: boolean;
}
export declare const fiscalUnitsApi: {
    /**
     * Valor da unidade fiscal da UF vigente na data informada (data do óbito/doação).
     * Sem `referenceDate` devolve o último ponto conhecido, já marcado como `outdated`.
     * Devolve `null` tanto para UF sem série quanto para UF com índice bloqueado — nesse caso
     * não existe número a entregar; use `listSeriesBloqueadas()` para saber o motivo.
     */
    getUnit: (uf: string, referenceDate?: string) => FiscalUnit | null;
    /**
     * Igual a `getUnit`, mas nunca devolve null: se a UF não tiver índice utilizável, entrega o
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
    /**
     * UFs cujo índice não foi obtido em fonte oficial. Não é o mesmo que série desatualizada:
     * aqui não há número nenhum, e qualquer conversão de faixa para reais é impossível.
     */
    listSeriesBloqueadas: () => {
        uf: string;
        name: string;
        motivo: string;
    }[];
    /**
     * Meses do ano informado sem vigência própria numa série mensal (retorna vazio para série
     * anual). É o que permite à tela avisar de antemão qual competência vai sair com ressalva.
     */
    listLacunasMensais: (uf: string, year: number) => string[];
};
