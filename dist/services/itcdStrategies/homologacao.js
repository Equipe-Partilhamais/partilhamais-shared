"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listUfsNaoConfiguradas = exports.isHomologada = exports.getHomologacao = exports.ITCD_HOMOLOGACAO = void 0;
const PENDENCIA_TABELA = 'Alíquotas/faixas não conferidas contra a lei estadual vigente.';
const PENDENCIA_DOACAO = 'Tabela de doação (inter vivos) não conferida; não há como distinguir da de causa mortis.';
exports.ITCD_HOMOLOGACAO = {
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
const getHomologacao = (uf) => exports.ITCD_HOMOLOGACAO[uf];
exports.getHomologacao = getHomologacao;
/** A UF está homologada para o tipo de fato gerador pedido? UF fora do registro nunca está. */
const isHomologada = (uf, taxType) => {
    const registro = (0, exports.getHomologacao)(uf);
    if (!registro)
        return false;
    return taxType === 'DOACAO' ? registro.doacao : registro.causaMortis;
};
exports.isHomologada = isHomologada;
/** UFs pendentes de tabela real, para acompanhamento e para o relatório de insumos externos. */
const listUfsNaoConfiguradas = (taxType) => Object.keys(exports.ITCD_HOMOLOGACAO).filter(uf => !(0, exports.isHomologada)(uf, taxType));
exports.listUfsNaoConfiguradas = listUfsNaoConfiguradas;
