import { UF } from '../../types';
import { ItcdTaxType } from './types';
declare const seloDeConferencia: unique symbol;
/** Assinatura humana da conferência. Sem ela nenhuma UF é homologada. */
export interface ConferenciaHumana {
    /** Quem conferiu a tabela contra a norma (nome/OAB ou setor responsável). */
    conferidaPor: string;
    /** Data da conferência, em AAAA-MM-DD. Nunca futura. */
    conferidaEm: string;
    /** Norma, artigo e início de vigência conferidos. Precisa citar norma E artigo. */
    referencia: string;
    /** Só `criarConferencia` produz esta marca; não escreva o campo à mão. */
    readonly [seloDeConferencia]: true;
}
/** Dados brutos de uma conferência, antes de validados. */
export interface ConferenciaEmBranco {
    conferidaPor: string;
    conferidaEm: string;
    referencia: string;
}
/**
 * A conferência tem conteúdo que sirva de prova? Objeto vazio, responsável em branco, data
 * inválida/futura ou referência sem norma e artigo NÃO são conferência: a UF segue pendente.
 */
export declare const conferenciaValida: (conferencia: unknown) => conferencia is ConferenciaHumana;
/**
 * Única porta de entrada de uma conferência assinada: recusa na hora o que não serve de prova,
 * em vez de deixar o registro nascer inválido e só aparecer lá na frente como "HOMOLOGADA".
 */
export declare const criarConferencia: (dados: ConferenciaEmBranco) => ConferenciaHumana;
export interface UfHomologacao {
    /**
     * Norma que o código CITA para a tabela desta UF. É rastreabilidade, não prova:
     * foi copiada do `legalText` da estratégia e não vale como conferência.
     */
    normaCitadaNoCodigo?: string;
    /** Conferência da tabela de causa mortis, via `criarConferencia`. `undefined` = pendente. */
    causaMortis?: ConferenciaHumana;
    /** Conferência da tabela de doação (inter vivos), via `criarConferencia`. `undefined` = pendente. */
    doacao?: ConferenciaHumana;
    /** O que falta conferir. Obrigatório enquanto a conferência não existir. */
    pendencia?: string;
}
export declare const ITCD_HOMOLOGACAO: Record<UF, UfHomologacao>;
export declare const getHomologacao: (uf: string) => UfHomologacao | undefined;
/** Conferência assinada para o tipo de fato gerador pedido, quando existir E for válida. */
export declare const getConferencia: (uf: string, taxType: ItcdTaxType) => ConferenciaHumana | undefined;
/**
 * A UF está homologada para o tipo de fato gerador pedido?
 * Só quando a conferência humana está assinada e completa — norma citada no código não homologa
 * nada, e selo sem conteúdo vale o mesmo que selo nenhum. UF fora do registro nunca está.
 */
export declare const isHomologada: (uf: string, taxType: ItcdTaxType) => boolean;
/** UFs pendentes de conferência, para acompanhamento e para o relatório de insumos externos. */
export declare const listUfsNaoConfiguradas: (taxType: ItcdTaxType) => UF[];
/** Pendência a exibir para a UF/tipo, já considerando a especificidade da doação. */
export declare const getPendencia: (uf: string, taxType: ItcdTaxType) => string | undefined;
export {};
