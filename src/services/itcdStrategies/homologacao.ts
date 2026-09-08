
import { UF } from '../../types';
import { ItcdTaxType } from './types';

// Registro único de homologação das tabelas de ITCD.
// Uma UF só é HOMOLOGADA quando a alíquota/faixa foi conferida contra a lei estadual vigente.
// Enquanto isso não acontece o motor continua devolvendo um número (os consumidores dependem
// dele para não quebrar), mas ele vem carimbado como NAO_CONFIGURADA e com aviso obrigatório —
// nunca como valor oficial. Este arquivo é o ponto de entrada para receber a tabela real:
// ao codificar a lei de uma UF, vire a flag correspondente para `true` e preencha `fonte`.

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

const PENDENCIA_TABELA = 'Alíquotas/faixas não conferidas contra a lei estadual vigente.';
const PENDENCIA_DOACAO = 'Tabela de doação (inter vivos) não conferida; não há como distinguir da de causa mortis.';

export const ITCD_HOMOLOGACAO: Record<UF, UfHomologacao> = {
    AC: { causaMortis: false, doacao: false, pendencia: PENDENCIA_TABELA },
    AL: { causaMortis: true, doacao: false, fonte: 'Lei nº 5.077/1989', pendencia: PENDENCIA_DOACAO },
    AM: { causaMortis: false, doacao: false, pendencia: PENDENCIA_TABELA },
    AP: { causaMortis: false, doacao: false, pendencia: PENDENCIA_TABELA },
    BA: { causaMortis: false, doacao: false, pendencia: PENDENCIA_TABELA },
    CE: { causaMortis: true, doacao: false, fonte: 'Lei nº 12.670/1996', pendencia: PENDENCIA_DOACAO },
    DF: { causaMortis: false, doacao: false, pendencia: PENDENCIA_TABELA },
    ES: { causaMortis: true, doacao: false, fonte: 'Lei nº 10.011/2013', pendencia: PENDENCIA_DOACAO },
    GO: { causaMortis: true, doacao: false, fonte: 'Lei nº 11.651/1991 (CTE/GO)', pendencia: PENDENCIA_DOACAO },
    MA: { causaMortis: false, doacao: false, pendencia: PENDENCIA_TABELA },
    MG: { causaMortis: true, doacao: true, fonte: 'Lei nº 14.941/2003' },
    MS: { causaMortis: true, doacao: false, fonte: 'Lei nº 1.810/1997', pendencia: PENDENCIA_DOACAO },
    MT: { causaMortis: true, doacao: false, fonte: 'Lei nº 7.850/2002', pendencia: PENDENCIA_DOACAO },
    PA: { causaMortis: false, doacao: false, pendencia: PENDENCIA_TABELA },
    PB: { causaMortis: true, doacao: false, fonte: 'Legislação estadual PB (alíquota única de 4%)', pendencia: PENDENCIA_DOACAO },
    PE: { causaMortis: true, doacao: false, fonte: 'Lei nº 13.974/2009', pendencia: PENDENCIA_DOACAO },
    PI: { causaMortis: false, doacao: false, pendencia: PENDENCIA_TABELA },
    PR: { causaMortis: false, doacao: false, pendencia: PENDENCIA_TABELA },
    RJ: { causaMortis: true, doacao: false, fonte: 'Lei nº 7.174/2015', pendencia: PENDENCIA_DOACAO },
    RN: { causaMortis: true, doacao: false, fonte: 'Legislação estadual RN (alíquota única de 3%)', pendencia: PENDENCIA_DOACAO },
    RO: { causaMortis: false, doacao: false, pendencia: PENDENCIA_TABELA },
    RR: { causaMortis: false, doacao: false, pendencia: PENDENCIA_TABELA },
    RS: { causaMortis: true, doacao: true, fonte: 'Lei nº 8.821/1989' },
    SC: { causaMortis: true, doacao: false, fonte: 'Lei nº 13.136/2004', pendencia: PENDENCIA_DOACAO },
    SE: { causaMortis: true, doacao: false, fonte: 'Legislação estadual SE (alíquota única de 8%)', pendencia: PENDENCIA_DOACAO },
    SP: { causaMortis: true, doacao: true, fonte: 'Lei nº 10.705/2000 (4% para causa mortis e doação)' },
    TO: { causaMortis: false, doacao: false, pendencia: PENDENCIA_TABELA },
};

export const getHomologacao = (uf: string): UfHomologacao | undefined => ITCD_HOMOLOGACAO[uf as UF];

/** A UF está homologada para o tipo de fato gerador pedido? UF fora do registro nunca está. */
export const isHomologada = (uf: string, taxType: ItcdTaxType): boolean => {
    const registro = getHomologacao(uf);
    if (!registro) return false;
    return taxType === 'DOACAO' ? registro.doacao : registro.causaMortis;
};

/** UFs pendentes de tabela real, para acompanhamento e para o relatório de insumos externos. */
export const listUfsNaoConfiguradas = (taxType: ItcdTaxType): UF[] =>
    (Object.keys(ITCD_HOMOLOGACAO) as UF[]).filter(uf => !isHomologada(uf, taxType));
