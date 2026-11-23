import { UF } from '../../types';

// Perfil jurídico de cada UF para o ITCD — o que a ESTRATÉGIA (alíquota/faixa) não diz:
// sobre que base a alíquota incide, se as dívidas abatem a base, em que situação está a
// tabela codificada e se há tabela própria de doação.
//
// REGRA DE PREENCHIMENTO: cada campo sai do que o repositório JÁ registra — comentários de
// pesquisa/divergência em `states/*.ts`, o registro de `homologacao.ts` e as mensagens de
// commit — e diz de onde saiu em `fonte*`. Nada aqui é conferência: a homologação continua
// sendo a assinatura humana de `homologacao.ts`, que este arquivo não toca. Mudar um campo
// sem fonte registrada é trocar um defeito visível por um invisível.

/**
 * QUINHAO: a alíquota incide sobre o quinhão de cada herdeiro/legatário — há um fato gerador
 * por beneficiário (CTN, art. 35, parágrafo único), e o enquadramento em faixa e as isenções
 * por valor são apurados quinhão a quinhão.
 * MONTE: a alíquota incide sobre o monte transmitido na UF, e o imposto é repartido.
 */
export type BaseDeCalculoItcd = 'QUINHAO' | 'MONTE';

/**
 * true: as dívidas (do espólio e as que oneram o bem) abatem a base.
 * false: a lei manda NÃO abater nenhuma dívida.
 * 'controvertido': não há regra registrada; o motor segue o tratamento escolhido para cada
 * dívida e avisa, mostrando a base bruta e a base com todas as dívidas abatidas.
 */
export type AbatimentoDividasItcd = true | false | 'controvertido';

/**
 * PESQUISADA: a tabela foi conferida em fonte primária e o arquivo da UF registra norma,
 * artigo, data e endereço da consulta — ainda sem assinatura de conferência.
 * DIVERGENCIA_CONHECIDA: o repositório registra que a tabela codificada DIVERGE da lei.
 * FAIXAS_ESTIMADAS: faixas progressivas sem fonte legal (o próprio código as declara
 * estimadas ou não cita norma nenhuma).
 * REFERENCIA: alíquota/faixa que cita (ou não) uma norma, sem registro de pesquisa nem de
 * divergência — valor só de referência.
 */
export type SituacaoTabelaItcd = 'PESQUISADA' | 'DIVERGENCIA_CONHECIDA' | 'FAIXAS_ESTIMADAS' | 'REFERENCIA';

/**
 * PROPRIA: a estratégia tem tabela própria de doação (ramifica por `taxType`).
 * MESMA_DA_CAUSA_MORTIS: a lei registrada aplica à doação a mesma tabela da causa mortis.
 * NAO_REGISTRADA: a estratégia usa a regra de causa mortis por falta de tabela de doação.
 */
export type TabelaDoacaoItcd = 'PROPRIA' | 'MESMA_DA_CAUSA_MORTIS' | 'NAO_REGISTRADA';

export interface PerfilItcdUf {
    baseDeCalculo: BaseDeCalculoItcd;
    fonteBaseDeCalculo: string;
    abateDividas: AbatimentoDividasItcd;
    fonteAbateDividas: string;
    situacaoTabela: SituacaoTabelaItcd;
    /** Onde o repositório registra a situação (arquivo, commit ou auditoria). */
    fonteSituacao: string;
    /** Na divergência conhecida: o que a lei diz e o código não faz, em uma frase. */
    resumoDivergencia?: string;
    tabelaDoacao: TabelaDoacaoItcd;
    /**
     * Início de vigência da redação codificada (AAAA-MM-DD), quando o repositório o registra.
     * Fato gerador anterior a esta data: a tabela do código NÃO é a que se aplica e a anterior
     * não está aqui — o cálculo sai indeterminado, com aviso e trava na minuta.
     */
    vigenciaDesde?: string;
    /** De onde saiu a data acima, e se é data de efeitos ou só da publicação da lei. */
    fonteVigencia?: string;
}

// CTN, art. 35, parágrafo único: "Nas transmissões causa mortis, ocorrem tantos fatos
// geradores distintos quantos sejam os herdeiros ou legatários." Norma geral nacional: vale
// para as 27 UFs enquanto nenhuma lei estadual registrada aqui disser outra coisa.
export const CTN_35 = 'CTN, art. 35, parágrafo único (um fato gerador por herdeiro ou legatário)';

const BASE_QUINHAO = { baseDeCalculo: 'QUINHAO' as const, fonteBaseDeCalculo: CTN_35 };

// Sem fonte registrada sobre o abatimento de dívidas: comportamento atual (depende do
// tratamento escolhido para cada dívida) com aviso de tema controvertido.
const SEM_REGRA_DE_DIVIDAS = {
    abateDividas: 'controvertido' as const,
    fonteAbateDividas: 'Sem regra registrada no repositório para esta UF.',
};

const REFERENCIA = (fonte: string) => ({ situacaoTabela: 'REFERENCIA' as const, fonteSituacao: fonte });
const ESTIMADAS = (fonte: string) => ({ situacaoTabela: 'FAIXAS_ESTIMADAS' as const, fonteSituacao: fonte });
const PESQUISADA = (fonte: string) => ({ situacaoTabela: 'PESQUISADA' as const, fonteSituacao: fonte });
const DIVERGENTE = (fonte: string, resumoDivergencia: string) => ({
    situacaoTabela: 'DIVERGENCIA_CONHECIDA' as const,
    fonteSituacao: fonte,
    resumoDivergencia,
});

const SEM_DOACAO = { tabelaDoacao: 'NAO_REGISTRADA' as const };
const DOACAO_PROPRIA = { tabelaDoacao: 'PROPRIA' as const };

export const PERFIL_ITCD_UF: Record<UF, PerfilItcdUf> = {
    AC: {
        ...BASE_QUINHAO, ...SEM_REGRA_DE_DIVIDAS, ...SEM_DOACAO,
        ...DIVERGENTE(
            'states/AC.ts (comentário "DIVERGÊNCIA CONHECIDA") e commit 0499321',
            'a LC/AC nº 373/2020, arts. 29 e 30, tem tabelas progressivas (4% a 7% na causa mortis; 2% a 8% na doação); o código cobra 4% fixo.'
        ),
    },
    AL: {
        // "Enquadramento pelo valor do quinhão" (legalText) — art. 168: "caso a parcela da base
        // de cálculo (quinhão) seja até X".
        baseDeCalculo: 'QUINHAO',
        fonteBaseDeCalculo: `${CTN_35}; Lei/AL nº 5.077/1989, art. 168 ("parcela da base de cálculo (quinhão)"), conforme states/AL.ts`,
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
        fonteBaseDeCalculo: `${CTN_35}; Lei/BA nº 4.826/1989, art. 4º, V (isenção pelo valor do quinhão desde 27/03/2025), conforme states/BA.ts`,
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
        ...DIVERGENTE(
            'states/PA.ts (comentário "DIVERGÊNCIA CONHECIDA") e commit 0499321',
            'a Lei/PA nº 5.529/1989, art. 8º (red. Lei nº 8.868/2019), tem tabela progressiva em UPF-PA (2% a 6%); o código cobra 4% fixo.'
        ),
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
        ...DIVERGENTE(
            'auditoria de 17/11/2026, cartão CALC-06 (fonte secundária), registrada em states/RN.ts',
            'segundo a auditoria, a Lei/RN nº 9.993/2015 tem tabela marginal de 3% a 6%; o código cobra 3% fixo (em R$ 4 milhões, R$ 120.000 contra cerca de R$ 195.000).'
        ),
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
        fonteBaseDeCalculo: `${CTN_35}; Lei/RS nº 8.821/1989, art. 18, § 1º ("alíquota correspondente sobre o valor do quinhão"), conforme states/RS.ts`,
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
        ...DIVERGENTE(
            'states/SE.ts (comentário "DIVERGÊNCIA CONHECIDA E GRAVE") e commit 0499321',
            'a Lei/SE nº 7.724/2013, art. 14, tem causa mortis progressiva de 3%, 6% e 8% e 2% na doação de móveis; o código cobra 8% fixo (o teto) em tudo.'
        ),
    },
    SP: {
        ...BASE_QUINHAO,
        abateDividas: false,
        fonteAbateDividas:
            'Lei/SP nº 10.705/2000, art. 12: no cálculo do imposto não serão abatidas quaisquer dívidas que onerem o bem transmitido, nem as do espólio.',
        // states/SP.ts: "Alíquota fixa de 4% tanto para Causa Mortis quanto Doação".
        tabelaDoacao: 'MESMA_DA_CAUSA_MORTIS',
        ...REFERENCIA('states/SP.ts — cita a Lei nº 10.705/2000, sem registro de pesquisa'),
    },
    TO: {
        ...BASE_QUINHAO, ...SEM_REGRA_DE_DIVIDAS, ...SEM_DOACAO,
        // O commit 0499321 lista o TO entre as UFs com "faixas divergentes da lei", mas não
        // tocou o arquivo (a auditoria de 17/11/2026 confirmou). O próprio arquivo chama as
        // faixas de estimadas. A divergência registrada prevalece sobre a estimativa.
        ...DIVERGENTE(
            'commit 0499321 ("AL, AC, BA, PA, PB, TO: faixas divergentes da lei"); states/TO.ts não foi corrigido',
            'a pesquisa de fonte primária registrou que as faixas do código divergem da lei do TO; a lei não foi transcrita no repositório.'
        ),
    },
};

/**
 * UF fora do registro: perfil conservador — base por quinhão (norma geral do CTN), abatimento
 * controvertido e tabela de referência. Nunca devolve `undefined`, para que nenhum consumidor
 * trate "sem perfil" como "sem ressalva".
 */
export const getPerfilItcdUf = (uf: string): PerfilItcdUf =>
    PERFIL_ITCD_UF[uf as UF] ?? {
        ...BASE_QUINHAO,
        ...SEM_REGRA_DE_DIVIDAS,
        ...SEM_DOACAO,
        ...REFERENCIA(`UF "${uf}" sem estratégia própria`),
    };

/** A base por quinhão desta UF se apoia só no CTN, sem norma estadual registrada? */
export const baseSoPeloCtn = (uf: string): boolean => getPerfilItcdUf(uf).fonteBaseDeCalculo === CTN_35;

/**
 * Situação da vigência registrada da tabela em relação à data do fato gerador:
 * VIGENTE, ANTERIOR (fato gerador antes do início — tabela não se aplica), SEM_DATA (há início
 * registrado mas a data não foi informada) ou SEM_REGISTRO (nada registrado para conferir).
 */
export const situacaoDaVigencia = (uf: string, dataFatoGerador?: string): 'VIGENTE' | 'ANTERIOR' | 'SEM_DATA' | 'SEM_REGISTRO' => {
    const desde = getPerfilItcdUf(uf).vigenciaDesde;
    if (!desde) return 'SEM_REGISTRO';
    if (!dataFatoGerador) return 'SEM_DATA';
    return dataFatoGerador.slice(0, 10) < desde ? 'ANTERIOR' : 'VIGENTE';
};

/** A minuta precisa de confirmação explícita do advogado para esta UF? (CALC-06) */
export const exigeConfirmacaoNaMinuta = (uf: string): boolean =>
    getPerfilItcdUf(uf).situacaoTabela === 'DIVERGENCIA_CONHECIDA' || getPerfilItcdUf(uf).situacaoTabela === 'FAIXAS_ESTIMADAS';
