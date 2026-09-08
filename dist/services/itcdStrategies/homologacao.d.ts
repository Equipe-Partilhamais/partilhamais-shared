import { UF } from '../../types';
import { ItcdTaxType } from './types';
export interface UfHomologacao {
    /** Tabela de causa mortis conferida contra a lei estadual. */
    causaMortis: boolean;
    /** Tabela de doação própria (distinta ou comprovadamente idêntica à de causa mortis). */
    doacao: boolean;
    /** Norma conferida, quando houver. */
    fonte?: string;
    /** O que falta para homologar. Obrigatório quando alguma das flags é false. */
    pendencia?: string;
}
export declare const ITCD_HOMOLOGACAO: Record<UF, UfHomologacao>;
export declare const getHomologacao: (uf: string) => UfHomologacao | undefined;
/** A UF está homologada para o tipo de fato gerador pedido? UF fora do registro nunca está. */
export declare const isHomologada: (uf: string, taxType: ItcdTaxType) => boolean;
/** UFs pendentes de tabela real, para acompanhamento e para o relatório de insumos externos. */
export declare const listUfsNaoConfiguradas: (taxType: ItcdTaxType) => UF[];
