import { UF } from '../../types';
import { ItcdTaxType } from './types';
/** Assinatura humana da conferência. Sem ela nenhuma UF é homologada. */
export interface ConferenciaHumana {
    /** Quem conferiu a tabela contra a norma (nome/OAB ou setor responsável). */
    conferidaPor: string;
    /** Data da conferência, em AAAA-MM-DD. */
    conferidaEm: string;
    /** Norma, artigo e início de vigência conferidos. */
    referencia: string;
}
export interface UfHomologacao {
    /**
     * Norma que o código CITA para a tabela desta UF. É rastreabilidade, não prova:
     * foi copiada do `legalText` da estratégia e não vale como conferência.
     */
    normaCitadaNoCodigo?: string;
    /** Conferência da tabela de causa mortis. `undefined` = pendente. */
    causaMortis?: ConferenciaHumana;
    /** Conferência da tabela de doação (inter vivos). `undefined` = pendente. */
    doacao?: ConferenciaHumana;
    /** O que falta conferir. Obrigatório enquanto a conferência não existir. */
    pendencia?: string;
}
export declare const ITCD_HOMOLOGACAO: Record<UF, UfHomologacao>;
export declare const getHomologacao: (uf: string) => UfHomologacao | undefined;
/** Conferência assinada para o tipo de fato gerador pedido, quando existir. */
export declare const getConferencia: (uf: string, taxType: ItcdTaxType) => ConferenciaHumana | undefined;
/**
 * A UF está homologada para o tipo de fato gerador pedido?
 * Só quando a conferência humana está assinada — norma citada no código não homologa nada.
 * UF fora do registro nunca está.
 */
export declare const isHomologada: (uf: string, taxType: ItcdTaxType) => boolean;
/** UFs pendentes de conferência, para acompanhamento e para o relatório de insumos externos. */
export declare const listUfsNaoConfiguradas: (taxType: ItcdTaxType) => UF[];
/** Pendência a exibir para a UF/tipo, já considerando a especificidade da doação. */
export declare const getPendencia: (uf: string, taxType: ItcdTaxType) => string | undefined;
