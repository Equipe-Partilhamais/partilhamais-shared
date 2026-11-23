import { UF } from '../../types';
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
export declare const CTN_35 = "CTN, art. 35, par\u00E1grafo \u00FAnico (um fato gerador por herdeiro ou legat\u00E1rio)";
export declare const PERFIL_ITCD_UF: Record<UF, PerfilItcdUf>;
/**
 * UF fora do registro: perfil conservador — base por quinhão (norma geral do CTN), abatimento
 * controvertido e tabela de referência. Nunca devolve `undefined`, para que nenhum consumidor
 * trate "sem perfil" como "sem ressalva".
 */
export declare const getPerfilItcdUf: (uf: string) => PerfilItcdUf;
/** A base por quinhão desta UF se apoia só no CTN, sem norma estadual registrada? */
export declare const baseSoPeloCtn: (uf: string) => boolean;
/**
 * Situação da vigência registrada da tabela em relação à data do fato gerador:
 * VIGENTE, ANTERIOR (fato gerador antes do início — tabela não se aplica), SEM_DATA (há início
 * registrado mas a data não foi informada) ou SEM_REGISTRO (nada registrado para conferir).
 */
export declare const situacaoDaVigencia: (uf: string, dataFatoGerador?: string) => "VIGENTE" | "ANTERIOR" | "SEM_DATA" | "SEM_REGISTRO";
/** A minuta precisa de confirmação explícita do advogado para esta UF? (CALC-06) */
export declare const exigeConfirmacaoNaMinuta: (uf: string) => boolean;
