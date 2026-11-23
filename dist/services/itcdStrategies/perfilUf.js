"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.exigeConfirmacaoNaMinuta = exports.situacaoDaVigencia = exports.baseSoPeloCtn = exports.getPerfilItcdUf = exports.PERFIL_ITCD_UF = exports.CTN_35 = void 0;
// CTN, art. 35, parágrafo único: "Nas transmissões causa mortis, ocorrem tantos fatos
// geradores distintos quantos sejam os herdeiros ou legatários." Norma geral nacional: vale
// para as 27 UFs enquanto nenhuma lei estadual registrada aqui disser outra coisa.
exports.CTN_35 = 'CTN, art. 35, parágrafo único (um fato gerador por herdeiro ou legatário)';
const BASE_QUINHAO = { baseDeCalculo: 'QUINHAO', fonteBaseDeCalculo: exports.CTN_35 };
// Sem fonte registrada sobre o abatimento de dívidas: comportamento atual (depende do
// tratamento escolhido para cada dívida) com aviso de tema controvertido.
const SEM_REGRA_DE_DIVIDAS = {
    abateDividas: 'controvertido',
    fonteAbateDividas: 'Sem regra registrada no repositório para esta UF.',
};
const REFERENCIA = (fonte) => ({ situacaoTabela: 'REFERENCIA', fonteSituacao: fonte });
const ESTIMADAS = (fonte) => ({ situacaoTabela: 'FAIXAS_ESTIMADAS', fonteSituacao: fonte });
const PESQUISADA = (fonte) => ({ situacaoTabela: 'PESQUISADA', fonteSituacao: fonte });
const DIVERGENTE = (fonte, resumoDivergencia) => ({
    situacaoTabela: 'DIVERGENCIA_CONHECIDA',
    fonteSituacao: fonte,
    resumoDivergencia,
});
const SEM_DOACAO = { tabelaDoacao: 'NAO_REGISTRADA' };
const DOACAO_PROPRIA = { tabelaDoacao: 'PROPRIA' };
exports.PERFIL_ITCD_UF = {
    AC: {
        ...BASE_QUINHAO, ...SEM_REGRA_DE_DIVIDAS, ...SEM_DOACAO,
        ...DIVERGENTE('states/AC.ts (comentário "DIVERGÊNCIA CONHECIDA") e commit 0499321', 'a LC/AC nº 373/2020, arts. 29 e 30, tem tabelas progressivas (4% a 7% na causa mortis; 2% a 8% na doação); o código cobra 4% fixo.'),
    },
    AL: {
        // "Enquadramento pelo valor do quinhão" (legalText) — art. 168: "caso a parcela da base
        // de cálculo (quinhão) seja até X".
        baseDeCalculo: 'QUINHAO',
        fonteBaseDeCalculo: `${exports.CTN_35}; Lei/AL nº 5.077/1989, art. 168 ("parcela da base de cálculo (quinhão)"), conforme states/AL.ts`,
        ...SEM_REGRA_DE_DIVIDAS, ...DOACAO_PROPRIA,
        ...PESQUISADA('states/AL.ts — texto conferido em 09/09/2026 no SAPL/AL (Lei nº 9.440/2024); método (enquadramento x marginal) registrado como em aberto'),
        // Só a data da LEI está registrada; o início dos efeitos (anterioridade) não. Antes dela a
        // tabela certamente não valia; depois, a conferir.
        vigenciaDesde: '2024-12-27',
        fonteVigencia: 'states/AL.ts — data da Lei nº 9.440/2024 (27/12/2024); início de efeitos não registrado',
    },
    AM: {
        ...BASE_QUINHAO, ...SEM_REGRA_DE_DIVIDAS, ...SEM_DOACAO,
        ...ESTIMADAS('states/AM.ts — comentário "Faixas estimadas", sem norma citada'),
    },
    AP: {
        ...BASE_QUINHAO, ...SEM_REGRA_DE_DIVIDAS, ...SEM_DOACAO,
        ...ESTIMADAS('states/AP.ts — comentário "Faixas estimadas pois documento não citou valores"'),
    },
    BA: {
        baseDeCalculo: 'QUINHAO',
        fonteBaseDeCalculo: `${exports.CTN_35}; Lei/BA nº 4.826/1989, art. 4º, V (isenção pelo valor do quinhão desde 27/03/2025), conforme states/BA.ts`,
        ...SEM_REGRA_DE_DIVIDAS, ...DOACAO_PROPRIA,
        ...PESQUISADA('states/BA.ts — texto conferido em 09/09/2026 no Portal de Legislação da Casa Civil/BA (Lei nº 14.802/2024)'),
        vigenciaDesde: '2025-03-27',
        fonteVigencia: 'states/BA.ts — Lei nº 14.802/2024, "com efeitos desde 27/03/2025"',
    },
    CE: {
        ...BASE_QUINHAO, ...SEM_REGRA_DE_DIVIDAS, ...SEM_DOACAO,
        ...REFERENCIA('states/CE.ts — cita a Lei nº 12.670/1996, sem registro de pesquisa'),
    },
    DF: {
        ...BASE_QUINHAO, ...SEM_REGRA_DE_DIVIDAS, ...SEM_DOACAO,
        ...ESTIMADAS('states/DF.ts — faixas de "exemplo fornecido pelo usuário", sem norma citada'),
    },
    ES: {
        ...BASE_QUINHAO, ...SEM_REGRA_DE_DIVIDAS, ...SEM_DOACAO,
        ...REFERENCIA('states/ES.ts — cita a Lei nº 10.011/2013, sem registro de pesquisa'),
    },
    GO: {
        ...BASE_QUINHAO, ...SEM_REGRA_DE_DIVIDAS,
        // "O art. 78 não distingue causa mortis de doação: a mesma tabela vale para os dois."
        tabelaDoacao: 'MESMA_DA_CAUSA_MORTIS',
        ...PESQUISADA('states/GO.ts — texto conferido em 09/09/2026 na SEFAZ/GO (Lei nº 19.021/2015)'),
        vigenciaDesde: '2016-01-01',
        fonteVigencia: 'states/GO.ts — Lei nº 19.021/2015, "com efeitos desde 01/01/2016"',
    },
    MA: {
        ...BASE_QUINHAO, ...SEM_REGRA_DE_DIVIDAS, ...SEM_DOACAO,
        ...REFERENCIA('states/MA.ts — alíquota de referência de 4%, sem norma citada'),
    },
    MG: {
        ...BASE_QUINHAO, ...SEM_REGRA_DE_DIVIDAS, ...DOACAO_PROPRIA,
        ...REFERENCIA('states/MG.ts — cita a Lei nº 14.941/2003, sem registro de pesquisa'),
    },
    MS: {
        ...BASE_QUINHAO, ...SEM_REGRA_DE_DIVIDAS, ...SEM_DOACAO,
        ...REFERENCIA('states/MS.ts — cita a Lei nº 1.810/1997, sem registro de pesquisa'),
    },
    MT: {
        ...BASE_QUINHAO, ...SEM_REGRA_DE_DIVIDAS, ...SEM_DOACAO,
        ...REFERENCIA('states/MT.ts — cita a Lei nº 7.850/2002, sem registro de pesquisa'),
    },
    PA: {
        ...BASE_QUINHAO, ...SEM_REGRA_DE_DIVIDAS, ...SEM_DOACAO,
        ...DIVERGENTE('states/PA.ts (comentário "DIVERGÊNCIA CONHECIDA") e commit 0499321', 'a Lei/PA nº 5.529/1989, art. 8º (red. Lei nº 8.868/2019), tem tabela progressiva em UPF-PA (2% a 6%); o código cobra 4% fixo.'),
    },
    PB: {
        ...BASE_QUINHAO, ...SEM_REGRA_DE_DIVIDAS, ...DOACAO_PROPRIA,
        ...PESQUISADA('states/PB.ts — texto conferido em 09/09/2026 no portal da SEFAZ-PB (Lei nº 12.585/2023)'),
        vigenciaDesde: '2023-03-10',
        fonteVigencia: 'states/PB.ts — data da Lei nº 12.585/2023 (10/03/2023); início de efeitos não registrado',
    },
    PE: {
        ...BASE_QUINHAO, ...SEM_REGRA_DE_DIVIDAS, ...SEM_DOACAO,
        ...REFERENCIA('states/PE.ts — cita a Lei nº 13.974/2009, sem registro de pesquisa'),
    },
    PI: {
        ...BASE_QUINHAO, ...SEM_REGRA_DE_DIVIDAS, ...SEM_DOACAO,
        ...REFERENCIA('states/PI.ts — alíquota de referência de 4%, sem norma citada'),
    },
    PR: {
        ...BASE_QUINHAO, ...SEM_REGRA_DE_DIVIDAS, ...SEM_DOACAO,
        ...REFERENCIA('states/PR.ts — alíquota de referência de 4%, sem norma citada'),
    },
    RJ: {
        ...BASE_QUINHAO, ...SEM_REGRA_DE_DIVIDAS, ...SEM_DOACAO,
        ...REFERENCIA('states/RJ.ts — cita a Lei nº 7.174/2015, sem registro de pesquisa'),
    },
    RN: {
        ...BASE_QUINHAO, ...SEM_REGRA_DE_DIVIDAS, ...SEM_DOACAO,
        // A única UF classificada por fonte FORA dos arquivos de estado: o repositório não
        // registrava nada sobre o RN além do texto "alíquota única de 3%", que a auditoria de
        // 17/11/2026 (CALC-06) aponta como falso. Classificada como divergente por ser o
        // caminho conservador (a minuta passa a exigir confirmação); a fonte é secundária.
        ...DIVERGENTE('auditoria de 17/11/2026, cartão CALC-06 (fonte secundária), registrada em states/RN.ts', 'segundo a auditoria, a Lei/RN nº 9.993/2015 tem tabela marginal de 3% a 6%; o código cobra 3% fixo (em R$ 4 milhões, R$ 120.000 contra cerca de R$ 195.000).'),
    },
    RO: {
        ...BASE_QUINHAO, ...SEM_REGRA_DE_DIVIDAS, ...SEM_DOACAO,
        ...ESTIMADAS('states/RO.ts — faixas sem norma citada'),
    },
    RR: {
        ...BASE_QUINHAO, ...SEM_REGRA_DE_DIVIDAS, ...SEM_DOACAO,
        ...REFERENCIA('states/RR.ts — alíquota de referência de 4%, sem norma citada'),
    },
    RS: {
        baseDeCalculo: 'QUINHAO',
        fonteBaseDeCalculo: `${exports.CTN_35}; Lei/RS nº 8.821/1989, art. 18, § 1º ("alíquota correspondente sobre o valor do quinhão"), conforme states/RS.ts`,
        ...SEM_REGRA_DE_DIVIDAS, ...DOACAO_PROPRIA,
        ...PESQUISADA('states/RS.ts — tabela conferida em 09/09/2026 no Portal de Serviços da Receita Estadual/RS (Lei nº 14.741/2015)'),
        vigenciaDesde: '2016-01-01',
        fonteVigencia: 'states/RS.ts — Lei nº 14.741/2015, "efeitos desde 01/01/2016"',
    },
    SC: {
        ...BASE_QUINHAO, ...SEM_REGRA_DE_DIVIDAS, ...SEM_DOACAO,
        ...REFERENCIA('states/SC.ts — cita a Lei nº 13.136/2004, sem registro de pesquisa'),
    },
    SE: {
        ...BASE_QUINHAO, ...SEM_REGRA_DE_DIVIDAS, ...SEM_DOACAO,
        ...DIVERGENTE('states/SE.ts (comentário "DIVERGÊNCIA CONHECIDA E GRAVE") e commit 0499321', 'a Lei/SE nº 7.724/2013, art. 14, tem causa mortis progressiva de 3%, 6% e 8% e 2% na doação de móveis; o código cobra 8% fixo (o teto) em tudo.'),
    },
    SP: {
        ...BASE_QUINHAO,
        abateDividas: false,
        fonteAbateDividas: 'Lei/SP nº 10.705/2000, art. 12: no cálculo do imposto não serão abatidas quaisquer dívidas que onerem o bem transmitido, nem as do espólio.',
        // states/SP.ts: "Alíquota fixa de 4% tanto para Causa Mortis quanto Doação".
        tabelaDoacao: 'MESMA_DA_CAUSA_MORTIS',
        ...REFERENCIA('states/SP.ts — cita a Lei nº 10.705/2000, sem registro de pesquisa'),
    },
    TO: {
        ...BASE_QUINHAO, ...SEM_REGRA_DE_DIVIDAS, ...SEM_DOACAO,
        // O commit 0499321 lista o TO entre as UFs com "faixas divergentes da lei", mas não
        // tocou o arquivo (a auditoria de 17/11/2026 confirmou). O próprio arquivo chama as
        // faixas de estimadas. A divergência registrada prevalece sobre a estimativa.
        ...DIVERGENTE('commit 0499321 ("AL, AC, BA, PA, PB, TO: faixas divergentes da lei"); states/TO.ts não foi corrigido', 'a pesquisa de fonte primária registrou que as faixas do código divergem da lei do TO; a lei não foi transcrita no repositório.'),
    },
};
/**
 * UF fora do registro: perfil conservador — base por quinhão (norma geral do CTN), abatimento
 * controvertido e tabela de referência. Nunca devolve `undefined`, para que nenhum consumidor
 * trate "sem perfil" como "sem ressalva".
 */
const getPerfilItcdUf = (uf) => exports.PERFIL_ITCD_UF[uf] ?? {
    ...BASE_QUINHAO,
    ...SEM_REGRA_DE_DIVIDAS,
    ...SEM_DOACAO,
    ...REFERENCIA(`UF "${uf}" sem estratégia própria`),
};
exports.getPerfilItcdUf = getPerfilItcdUf;
/** A base por quinhão desta UF se apoia só no CTN, sem norma estadual registrada? */
const baseSoPeloCtn = (uf) => (0, exports.getPerfilItcdUf)(uf).fonteBaseDeCalculo === exports.CTN_35;
exports.baseSoPeloCtn = baseSoPeloCtn;
/**
 * Situação da vigência registrada da tabela em relação à data do fato gerador:
 * VIGENTE, ANTERIOR (fato gerador antes do início — tabela não se aplica), SEM_DATA (há início
 * registrado mas a data não foi informada) ou SEM_REGISTRO (nada registrado para conferir).
 */
const situacaoDaVigencia = (uf, dataFatoGerador) => {
    const desde = (0, exports.getPerfilItcdUf)(uf).vigenciaDesde;
    if (!desde)
        return 'SEM_REGISTRO';
    if (!dataFatoGerador)
        return 'SEM_DATA';
    return dataFatoGerador.slice(0, 10) < desde ? 'ANTERIOR' : 'VIGENTE';
};
exports.situacaoDaVigencia = situacaoDaVigencia;
/** A minuta precisa de confirmação explícita do advogado para esta UF? (CALC-06) */
const exigeConfirmacaoNaMinuta = (uf) => (0, exports.getPerfilItcdUf)(uf).situacaoTabela === 'DIVERGENCIA_CONHECIDA' || (0, exports.getPerfilItcdUf)(uf).situacaoTabela === 'FAIXAS_ESTIMADAS';
exports.exigeConfirmacaoNaMinuta = exigeConfirmacaoNaMinuta;
