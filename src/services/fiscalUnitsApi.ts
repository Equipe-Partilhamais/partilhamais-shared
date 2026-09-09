
// Unidades fiscais estaduais (UFIR-RJ, UPF/MT, UFIRCE, UPF-RS, UFESP, UFR-PB, UFEMG).
// O ITCD é regido pela norma vigente na data do fato gerador (óbito ou doação), portanto o
// valor da unidade NÃO pode ser "o mais recente": tem de ser o que vigorava naquela competência.
// Por isso cada UF guarda uma SÉRIE `{ vigenciaInicio, value }` resolvida por data, e não um escalar.

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

interface FiscalUnitSeries {
    id: string;
    name: string;
    description: string;
    /** Ordenada por vigenciaInicio crescente. */
    vigencias: FiscalUnitVigencia[];
}

const REFERENCIA_2025 = 'Valor de referência Jan/2025 — pendente de conferência na SEFAZ estadual';

// Nenhum ponto da série foi conferido ainda; ver `conferida` em FiscalUnitVigencia.
const PONTO_REFERENCIAL = (vigenciaInicio: string, value: number): FiscalUnitVigencia => ({
    vigenciaInicio,
    value,
    source: REFERENCIA_2025,
    conferida: false,
});

// ATENÇÃO: só há um ponto por UF (Jan/2025). Enquanto a série real não for carregada, qualquer
// fato gerador fora de 2025 cai em `outdated: true`. Ver `listSeriesPendentes()`.
const SERIES: Record<string, FiscalUnitSeries> = {
    MT: {
        id: 'UPF_MT',
        name: 'UPF/MT',
        description: 'Unidade Padrão Fiscal de Mato Grosso',
        vigencias: [PONTO_REFERENCIAL('2025-01-01', 239.51)],
    },
    RS: {
        id: 'UPF_RS',
        name: 'UPF/RS',
        description: 'Unidade Padrão Fiscal do Rio Grande do Sul',
        vigencias: [PONTO_REFERENCIAL('2025-01-01', 27.24)],
    },
    CE: {
        id: 'UFIRCE',
        name: 'UFIRCE',
        description: 'Unidade Fiscal de Referência do Ceará',
        vigencias: [PONTO_REFERENCIAL('2025-01-01', 5.95)],
    },
    RJ: {
        id: 'UFIR_RJ',
        name: 'UFIR-RJ',
        description: 'Unidade Fiscal de Referência do Rio de Janeiro',
        vigencias: [PONTO_REFERENCIAL('2025-01-01', 4.65)],
    },
    SP: {
        id: 'UFESP',
        name: 'UFESP',
        description: 'Unidade Fiscal do Estado de São Paulo',
        vigencias: [PONTO_REFERENCIAL('2025-01-01', 36.37)],
    },
    PB: {
        id: 'UFR_PB',
        name: 'UFR-PB',
        description: 'Unidade Fiscal de Referência da Paraíba',
        vigencias: [PONTO_REFERENCIAL('2025-01-01', 67.89)],
    },
    MG: {
        id: 'UFEMG',
        name: 'UFEMG',
        description: 'Unidade Fiscal do Estado de Minas Gerais',
        vigencias: [PONTO_REFERENCIAL('2025-01-01', 5.62)],
    },
};

const parseDate = (value?: string): Date | null => {
    if (!value) return null;
    const [y, m, d] = value.split('-').map(Number);
    if (!y || !m || !d) return null;
    const parsed = new Date(y, m - 1, d);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const resolveVigencia = (series: FiscalUnitSeries, referenceDate?: string) => {
    const ordered = series.vigencias;
    const target = parseDate(referenceDate);

    if (!target) {
        const last = ordered[ordered.length - 1];
        // Sem data do fato gerador não há como afirmar que o valor é o correto para a competência.
        return { entry: last, outdated: true };
    }

    let chosen = ordered[0];
    let found = false;
    for (const entry of ordered) {
        const start = parseDate(entry.vigenciaInicio);
        if (start && start.getTime() <= target.getTime()) {
            chosen = entry;
            found = true;
        }
    }

    // Fora da cobertura da série: antes do primeiro ponto, ou em ano posterior ao último ponto.
    const chosenYear = Number(chosen.vigenciaInicio.slice(0, 4));
    const isLast = chosen === ordered[ordered.length - 1];
    const outdated = !found || (isLast && target.getFullYear() > chosenYear);

    return { entry: chosen, outdated };
};

export const fiscalUnitsApi = {
    /**
     * Valor da unidade fiscal da UF vigente na data informada (data do óbito/doação).
     * Sem `referenceDate` devolve o último ponto conhecido, já marcado como `outdated`.
     */
    getUnit: (uf: string, referenceDate?: string): FiscalUnit | null => {
        const series = SERIES[uf];
        if (!series) return null;

        const { entry, outdated } = resolveVigencia(series, referenceDate);

        return {
            id: series.id,
            name: series.name,
            description: series.description,
            value: entry.value,
            vigenciaInicio: entry.vigenciaInicio,
            source: entry.source,
            outdated,
            conferida: entry.conferida,
        };
    },

    /**
     * Igual a `getUnit`, mas nunca devolve null: se a UF não tiver série cadastrada, entrega o
     * fallback já carimbado como desatualizado, para o cálculo não silenciar a ausência de dado.
     */
    requireUnit: (uf: string, fallback: { id: string; name: string; value: number }, referenceDate?: string): FiscalUnit => {
        const unit = fiscalUnitsApi.getUnit(uf, referenceDate);
        if (unit) return unit;

        return {
            id: fallback.id,
            name: fallback.name,
            value: fallback.value,
            vigenciaInicio: '',
            source: 'Valor embutido no código — série de vigências não cadastrada para esta UF',
            description: fallback.name,
            outdated: true,
            conferida: false,
        };
    },

    getAllUnits: (referenceDate?: string): FiscalUnit[] =>
        Object.keys(SERIES)
            .map(uf => fiscalUnitsApi.getUnit(uf, referenceDate))
            .filter((unit): unit is FiscalUnit => unit !== null),

    /** Séries cuja última vigência conhecida é anterior ao ano informado — insumo externo pendente. */
    listSeriesPendentes: (year: number): { uf: string; name: string; ultimaVigencia: string }[] =>
        Object.entries(SERIES)
            .map(([uf, series]) => ({
                uf,
                name: series.name,
                ultimaVigencia: series.vigencias[series.vigencias.length - 1].vigenciaInicio,
            }))
            .filter(item => Number(item.ultimaVigencia.slice(0, 4)) < year),
};
