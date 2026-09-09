
// Unidades fiscais estaduais (UFIR-RJ, UPF/MT, UFIRCE, UPF-RS, UFESP, UFR-PB, UFEMG, UFP/SE, UPF/RO).
// O ITCD é regido pela norma vigente na data do fato gerador (óbito ou doação), portanto o
// valor da unidade NÃO pode ser "o mais recente": tem de ser o que vigorava naquela competência.
// Por isso cada UF guarda uma SÉRIE `{ vigenciaInicio, value }` resolvida por data, e não um escalar.

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

interface FiscalUnitSeries {
    id: string;
    name: string;
    description: string;
    periodicidade: FiscalUnitPeriodicidade;
    /** Ordenada por vigenciaInicio crescente. Vazia quando o índice não foi obtido (ver `bloqueio`). */
    vigencias: FiscalUnitVigencia[];
    /** Preenchido só nas UFs sem índice: por que a fonte oficial não entregou o valor. */
    bloqueio?: string;
}

// Nenhum ponto da série foi conferido: `pesquisa` marca a origem da norma, não a homologação.
// A assinatura humana (advogado do escritório) continua pendente em TODAS as UFs.
const pesquisa = (vigenciaInicio: string, value: number, source: string): FiscalUnitVigencia => ({
    vigenciaInicio,
    value,
    source,
    conferida: false,
});

// A tabela oficial da UFR-PB é publicada como série mensal única (mês a mês, sem citar a portaria
// de cada mês), então a fonte é a mesma para todos os pontos.
const FONTE_UFR_PB = 'Tabela oficial da UFR-PB — Secretaria de Estado da Fazenda da Paraíba (sefaz.pb.gov.br/info/indices-e-tabelas/ufr-pb)';
const ufrPb = (vigenciaInicio: string, value: number): FiscalUnitVigencia =>
    pesquisa(vigenciaInicio, value, FONTE_UFR_PB);

// Séries levantadas em lei/portaria estadual e reconferidas em fonte oficial em 09/09/2026.
// Nenhuma foi homologada: `conferida` continua `false` em todos os pontos.
const SERIES: Record<string, FiscalUnitSeries> = {
    MT: {
        id: 'UPF_MT',
        name: 'UPF/MT',
        description: 'Unidade Padrão Fiscal de Mato Grosso',
        // Mensal por força do § 3º do art. 47-B da Lei nº 7.098/1998 (correção pelo IPCA).
        periodicidade: 'MENSAL',
        vigencias: [
            pesquisa('2025-01-01', 243.49, 'Valor divulgado pela SEFAZ-MT para jan/2025 (reproduzido no Ofício Circular Anoreg-MT nº 01/2025); portaria de origem não localizada'),
            pesquisa('2025-12-01', 253.90, 'Portaria nº 172/2025-SEFAZ (MT), de 13/11/2025, DOE de 26/11/2025 — app1.sefaz.mt.gov.br'),
            pesquisa('2026-01-01', 254.36, 'Portaria nº 186/2025-SEFAZ (MT), de 17/12/2025, DOE de 19/12/2025'),
            pesquisa('2026-02-01', 255.20, 'Portaria nº 003/2026-SEFAZ (MT), de 13/01/2026'),
            pesquisa('2026-03-01', 256.04, 'Portaria nº 023/2026-SEFAZ (MT), de 19/02/2026 — app1.sefaz.mt.gov.br'),
            pesquisa('2026-04-01', 257.83, 'Portaria nº 040/2026-SEFAZ (MT), de 17/03/2026, DOE de 20/03/2026 — app1.sefaz.mt.gov.br'),
            pesquisa('2026-05-01', 260.10, 'Portaria nº 054/2026-SEFAZ (MT), DOE de 16/04/2026 — app1.sefaz.mt.gov.br'),
            pesquisa('2026-06-01', 261.84, 'Portaria nº 070/2026-SEFAZ (MT), de 18/05/2026'),
            pesquisa('2026-07-01', 263.36, 'Portaria nº 084/2026-SEFAZ (MT), de 17/06/2026'),
            pesquisa('2026-08-01', 263.78, 'Portaria nº 108/2026-SEFAZ (MT), de 17/07/2026, DOE de 22/07/2026'),
            pesquisa('2026-09-01', 263.97, 'Portaria nº 120/2026-SEFAZ (MT), de 13/08/2026, DOE de 24/08/2026'),
        ],
    },
    RS: {
        id: 'UPF_RS',
        name: 'UPF/RS',
        description: 'Unidade Padrão Fiscal do Rio Grande do Sul',
        periodicidade: 'ANUAL',
        vigencias: [
            pesquisa('2025-01-01', 27.13, 'IN RE nº 131/2024 (RS) — tabela oficial da UPF-RS no Portal de Serviços da Receita Estadual (atendimento.receita.rs.gov.br/upf-rs)'),
            pesquisa('2026-01-01', 28.3264, 'IN RE nº 111/2025, de 23/12/2025 (RS) — mesma tabela oficial da Receita Estadual'),
        ],
    },
    CE: {
        id: 'UFIRCE',
        name: 'UFIRCE',
        description: 'Unidade Fiscal de Referência do Ceará',
        periodicidade: 'ANUAL',
        vigencias: [
            pesquisa('2025-01-01', 6.02969, 'Instrução Normativa SEFAZ-CE nº 155, de 10/12/2024, efeitos a partir de 1º/01/2025'),
            pesquisa('2026-01-01', 6.29872, 'Instrução Normativa SEFAZ-CE nº 152, de 12/12/2025, DOE de 16/12/2025, efeitos a partir de 1º/01/2026'),
        ],
    },
    RJ: {
        id: 'UFIR_RJ',
        name: 'UFIR-RJ',
        description: 'Unidade Fiscal de Referência do Rio de Janeiro',
        periodicidade: 'ANUAL',
        vigencias: [
            pesquisa('2025-01-01', 4.7508, 'Resolução SEFAZ-RJ nº 746, de 27/12/2024, art. 1º, efeitos a partir de 1º/01/2025'),
            pesquisa('2026-01-01', 4.9604, 'Resolução SEFAZ-RJ nº 849, de 23/12/2025, art. 1º, efeitos a partir de 1º/01/2026'),
        ],
    },
    SP: {
        id: 'UFESP',
        name: 'UFESP',
        description: 'Unidade Fiscal do Estado de São Paulo',
        periodicidade: 'ANUAL',
        vigencias: [
            pesquisa('2025-01-01', 37.02, 'Comunicado DICAR nº 88, de 17/12/2024, DOE-SP de 18/12/2024 (1º/01 a 31/12/2025)'),
            pesquisa('2026-01-01', 38.42, 'Comunicado DICAR nº 88, de 17/12/2025, DOE-SP de 18/12/2025 (1º/01 a 31/12/2026)'),
        ],
    },
    PB: {
        id: 'UFR_PB',
        name: 'UFR-PB',
        description: 'Unidade Fiscal de Referência da Paraíba',
        // Reajustada mensalmente pelo IPCA, por portaria própria da SEFAZ-PB.
        periodicidade: 'MENSAL',
        vigencias: [
            ufrPb('2025-01-01', 68.38),
            ufrPb('2025-02-01', 68.74),
            ufrPb('2025-03-01', 68.85),
            ufrPb('2025-04-01', 69.75),
            ufrPb('2025-05-01', 70.14),
            ufrPb('2025-06-01', 70.44),
            ufrPb('2025-07-01', 70.63),
            ufrPb('2025-08-01', 70.80),
            ufrPb('2025-09-01', 70.98),
            ufrPb('2025-10-01', 70.98),
            ufrPb('2025-11-01', 71.24),
            ufrPb('2025-12-01', 71.31),
            ufrPb('2026-01-01', 71.44),
            ufrPb('2026-02-01', 71.67),
            ufrPb('2026-03-01', 71.91),
            ufrPb('2026-04-01', 72.41),
            ufrPb('2026-05-01', 73.05),
            ufrPb('2026-06-01', 73.54),
            ufrPb('2026-07-01', 73.96),
            ufrPb('2026-08-01', 74.08),
            ufrPb('2026-09-01', 74.13),
        ],
    },
    MG: {
        id: 'UFEMG',
        name: 'UFEMG',
        description: 'Unidade Fiscal do Estado de Minas Gerais',
        periodicidade: 'ANUAL',
        vigencias: [
            pesquisa('2025-01-01', 5.5310, 'Resolução SEF/MG nº 5.850, de 28/11/2024, art. 1º (exercício de 2025)'),
            pesquisa('2026-01-01', 5.7899, 'Resolução SEF/MG nº 5.969, de 28/11/2025, art. 1º, publicada em 29/11/2025 (exercício de 2026)'),
        ],
    },
    SE: {
        id: 'UFP_SE',
        name: 'UFP/SE',
        description: 'Unidade Fiscal Padrão do Estado de Sergipe',
        // Fixada por portaria MENSAL da SEFAZ/SE; só o ponto de set/2026 foi obtido em fonte oficial,
        // então todo mês anterior sai como lacuna, e não com o valor de setembro.
        periodicidade: 'MENSAL',
        vigencias: [
            pesquisa('2026-09-01', 86.25, 'Portaria SEFAZ/SE nº 0296/2026, de 27/08/2026, art. 1º, DOE/SE nº 29.960 de 01/09/2026'),
        ],
    },
    RO: {
        id: 'UPF_RO',
        name: 'UPF/RO',
        description: 'Unidade Padrão Fiscal do Estado de Rondônia',
        periodicidade: 'ANUAL',
        vigencias: [
            pesquisa('2025-01-01', 119.14, 'Resolução nº 4/2024/GAB/CRE (RO), de 11/12/2024, art. 1º, efeitos a partir de 1º/01/2025'),
            pesquisa('2026-01-01', 124.46, 'Resolução nº 3/2025/GAB/CRE (RO), de 12/12/2025, art. 1º, efeitos a partir de 1º/01/2026 — sefin.ro.gov.br'),
        ],
    },
    AP: {
        id: 'UPF_AP',
        name: 'UPF/AP',
        description: 'Unidade Padrão Fiscal do Estado do Amapá',
        periodicidade: 'MENSAL',
        // Sem valor: inventar um número aqui converteria as faixas do ITCD com índice errado.
        vigencias: [],
        bloqueio:
            'Índice não obtido em fonte oficial: em 09/09/2026 o portal da SEFAZ-AP (www.sefaz.ap.gov.br) ' +
            'responde com certificado TLS expirado e nenhuma portaria com o valor da UPF/AP em reais foi localizada.',
    },
};

const parseDate = (value?: string): Date | null => {
    if (!value) return null;
    const [y, m, d] = value.split('-').map(Number);
    if (!y || !m || !d) return null;
    const parsed = new Date(y, m - 1, d);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const competencia = (data: Date): string =>
    `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}`;

const rotuloMes = (competenciaAlvo: string): string => {
    const [ano, mes] = competenciaAlvo.split('-');
    return `${mes}/${ano}`;
};

interface VigenciaResolvida {
    entry: FiscalUnitVigencia;
    outdated: boolean;
    /** Só em série mensal: o mês do fato gerador não tem vigência própria. */
    lacuna: boolean;
    /** Mês do fato gerador, para a ressalva. Vazio quando não houve data. */
    competenciaAlvo: string;
}

const resolveVigencia = (series: FiscalUnitSeries, referenceDate?: string): VigenciaResolvida => {
    const ordered = series.vigencias;
    const target = parseDate(referenceDate);

    if (!target) {
        const last = ordered[ordered.length - 1];
        // Sem data do fato gerador não há como afirmar que o valor é o correto para a competência.
        return { entry: last, outdated: true, lacuna: false, competenciaAlvo: '' };
    }

    const competenciaAlvo = competencia(target);

    let chosen = ordered[0];
    let found = false;
    for (const entry of ordered) {
        const start = parseDate(entry.vigenciaInicio);
        if (start && start.getTime() <= target.getTime()) {
            chosen = entry;
            found = true;
        }
    }

    // Antes do primeiro ponto da série: não há valor para a competência, nem anterior a copiar.
    if (!found) {
        return { entry: chosen, outdated: true, lacuna: false, competenciaAlvo };
    }

    if (series.periodicidade === 'MENSAL') {
        // Numa série mensal, "o ponto anterior" é índice de OUTRO mês. Ele é devolvido para o
        // cálculo não parar, mas sempre marcado — antes disso o buraco era preenchido em silêncio.
        const lacuna = chosen.vigenciaInicio.slice(0, 7) !== competenciaAlvo;
        return { entry: chosen, outdated: lacuna, lacuna, competenciaAlvo };
    }

    // Série anual: fora da cobertura quando o fato gerador é de ano posterior ao último ponto.
    const chosenYear = Number(chosen.vigenciaInicio.slice(0, 4));
    const isLast = chosen === ordered[ordered.length - 1];
    return {
        entry: chosen,
        outdated: isLast && target.getFullYear() > chosenYear,
        lacuna: false,
        competenciaAlvo,
    };
};

export const fiscalUnitsApi = {
    /**
     * Valor da unidade fiscal da UF vigente na data informada (data do óbito/doação).
     * Sem `referenceDate` devolve o último ponto conhecido, já marcado como `outdated`.
     * Devolve `null` tanto para UF sem série quanto para UF com índice bloqueado — nesse caso
     * não existe número a entregar; use `listSeriesBloqueadas()` para saber o motivo.
     */
    getUnit: (uf: string, referenceDate?: string): FiscalUnit | null => {
        const series = SERIES[uf];
        if (!series || series.vigencias.length === 0) return null;

        const { entry, outdated, lacuna, competenciaAlvo } = resolveVigencia(series, referenceDate);

        return {
            id: series.id,
            name: series.name,
            description: series.description,
            periodicidade: series.periodicidade,
            value: entry.value,
            vigenciaInicio: entry.vigenciaInicio,
            // A ressalva entra na própria `source` porque é o campo que o motor propaga até a tela
            // e o documento entregue ao cliente.
            source: lacuna
                ? `${entry.source} — SÉRIE MENSAL SEM VALOR PARA ${rotuloMes(competenciaAlvo)}: aplicado o último mês publicado (${entry.vigenciaInicio})`
                : entry.source,
            outdated,
            lacunaNaSerie: lacuna,
            conferida: entry.conferida,
            indiceIndisponivel: false,
        };
    },

    /**
     * Igual a `getUnit`, mas nunca devolve null: se a UF não tiver índice utilizável, entrega o
     * fallback já carimbado como desatualizado, para o cálculo não silenciar a ausência de dado.
     */
    requireUnit: (uf: string, fallback: { id: string; name: string; value: number }, referenceDate?: string): FiscalUnit => {
        const unit = fiscalUnitsApi.getUnit(uf, referenceDate);
        if (unit) return unit;

        const bloqueio = SERIES[uf]?.bloqueio;

        return {
            id: fallback.id,
            name: fallback.name,
            value: fallback.value,
            vigenciaInicio: '',
            source: bloqueio
                ? `ÍNDICE INDISPONÍVEL para ${fallback.name}: ${bloqueio} O valor exibido é o embutido no código e NÃO serve de base de cálculo.`
                : 'Valor embutido no código — série de vigências não cadastrada para esta UF',
            description: fallback.name,
            periodicidade: SERIES[uf]?.periodicidade || 'ANUAL',
            outdated: true,
            lacunaNaSerie: false,
            conferida: false,
            indiceIndisponivel: !!bloqueio,
        };
    },

    getAllUnits: (referenceDate?: string): FiscalUnit[] =>
        Object.keys(SERIES)
            .map(uf => fiscalUnitsApi.getUnit(uf, referenceDate))
            .filter((unit): unit is FiscalUnit => unit !== null),

    /** Séries cuja última vigência conhecida é anterior ao ano informado — insumo externo pendente. */
    listSeriesPendentes: (year: number): { uf: string; name: string; ultimaVigencia: string }[] =>
        Object.entries(SERIES)
            .filter(([, series]) => series.vigencias.length > 0)
            .map(([uf, series]) => ({
                uf,
                name: series.name,
                ultimaVigencia: series.vigencias[series.vigencias.length - 1].vigenciaInicio,
            }))
            .filter(item => Number(item.ultimaVigencia.slice(0, 4)) < year),

    /**
     * UFs cujo índice não foi obtido em fonte oficial. Não é o mesmo que série desatualizada:
     * aqui não há número nenhum, e qualquer conversão de faixa para reais é impossível.
     */
    listSeriesBloqueadas: (): { uf: string; name: string; motivo: string }[] =>
        Object.entries(SERIES)
            .filter(([, series]) => !!series.bloqueio)
            .map(([uf, series]) => ({ uf, name: series.name, motivo: series.bloqueio! })),

    /**
     * Meses do ano informado sem vigência própria numa série mensal (retorna vazio para série
     * anual). É o que permite à tela avisar de antemão qual competência vai sair com ressalva.
     */
    listLacunasMensais: (uf: string, year: number): string[] => {
        const series = SERIES[uf];
        if (!series || series.periodicidade !== 'MENSAL' || series.vigencias.length === 0) return [];

        const publicados = new Set(series.vigencias.map(v => v.vigenciaInicio.slice(0, 7)));
        const lacunas: string[] = [];
        for (let mes = 1; mes <= 12; mes++) {
            const competenciaAlvo = `${year}-${String(mes).padStart(2, '0')}`;
            if (!publicados.has(competenciaAlvo)) lacunas.push(competenciaAlvo);
        }
        return lacunas;
    },
};
