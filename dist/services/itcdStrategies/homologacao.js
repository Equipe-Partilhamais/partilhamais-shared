"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPendencia = exports.listUfsNaoConfiguradas = exports.isHomologada = exports.getConferencia = exports.getHomologacao = exports.ITCD_HOMOLOGACAO = void 0;
const PENDENCIA_TABELA = 'Alíquotas/faixas ainda não conferidas contra a lei estadual vigente por um responsável identificado.';
const PENDENCIA_DOACAO = 'Tabela de doação (inter vivos) ainda não conferida; não há como afirmar que é idêntica à de causa mortis.';
// Nenhuma UF conferida: a auditoria não teve acesso a nenhuma lei estadual e o parecer
// tributário ainda não chegou. As normas abaixo são as que o código já citava no `legalText`
// de cada estratégia — ficam registradas para o conferente saber por onde começar.
exports.ITCD_HOMOLOGACAO = {
    AC: { pendencia: PENDENCIA_TABELA },
    AL: { normaCitadaNoCodigo: 'Lei nº 5.077/1989', pendencia: PENDENCIA_TABELA },
    AM: { pendencia: PENDENCIA_TABELA },
    AP: { pendencia: PENDENCIA_TABELA },
    BA: { pendencia: PENDENCIA_TABELA },
    CE: { normaCitadaNoCodigo: 'Lei nº 12.670/1996', pendencia: PENDENCIA_TABELA },
    DF: { pendencia: PENDENCIA_TABELA },
    ES: { normaCitadaNoCodigo: 'Lei nº 10.011/2013', pendencia: PENDENCIA_TABELA },
    GO: { normaCitadaNoCodigo: 'Lei nº 11.651/1991 (CTE/GO)', pendencia: PENDENCIA_TABELA },
    MA: { pendencia: PENDENCIA_TABELA },
    MG: { normaCitadaNoCodigo: 'Lei nº 14.941/2003', pendencia: PENDENCIA_TABELA },
    MS: { normaCitadaNoCodigo: 'Lei nº 1.810/1997', pendencia: PENDENCIA_TABELA },
    MT: { normaCitadaNoCodigo: 'Lei nº 7.850/2002', pendencia: PENDENCIA_TABELA },
    PA: { pendencia: PENDENCIA_TABELA },
    PB: { pendencia: PENDENCIA_TABELA },
    PE: { normaCitadaNoCodigo: 'Lei nº 13.974/2009', pendencia: PENDENCIA_TABELA },
    PI: { pendencia: PENDENCIA_TABELA },
    PR: { pendencia: PENDENCIA_TABELA },
    RJ: { normaCitadaNoCodigo: 'Lei nº 7.174/2015', pendencia: PENDENCIA_TABELA },
    RN: { pendencia: PENDENCIA_TABELA },
    RO: { pendencia: PENDENCIA_TABELA },
    RR: { pendencia: PENDENCIA_TABELA },
    RS: { normaCitadaNoCodigo: 'Lei nº 8.821/1989', pendencia: PENDENCIA_TABELA },
    SC: { normaCitadaNoCodigo: 'Lei nº 13.136/2004', pendencia: PENDENCIA_TABELA },
    SE: { pendencia: PENDENCIA_TABELA },
    SP: { normaCitadaNoCodigo: 'Lei nº 10.705/2000', pendencia: PENDENCIA_TABELA },
    TO: { pendencia: PENDENCIA_TABELA },
};
const getHomologacao = (uf) => exports.ITCD_HOMOLOGACAO[uf];
exports.getHomologacao = getHomologacao;
/** Conferência assinada para o tipo de fato gerador pedido, quando existir. */
const getConferencia = (uf, taxType) => {
    const registro = (0, exports.getHomologacao)(uf);
    if (!registro)
        return undefined;
    return taxType === 'DOACAO' ? registro.doacao : registro.causaMortis;
};
exports.getConferencia = getConferencia;
/**
 * A UF está homologada para o tipo de fato gerador pedido?
 * Só quando a conferência humana está assinada — norma citada no código não homologa nada.
 * UF fora do registro nunca está.
 */
const isHomologada = (uf, taxType) => !!(0, exports.getConferencia)(uf, taxType);
exports.isHomologada = isHomologada;
/** UFs pendentes de conferência, para acompanhamento e para o relatório de insumos externos. */
const listUfsNaoConfiguradas = (taxType) => Object.keys(exports.ITCD_HOMOLOGACAO).filter(uf => !(0, exports.isHomologada)(uf, taxType));
exports.listUfsNaoConfiguradas = listUfsNaoConfiguradas;
/** Pendência a exibir para a UF/tipo, já considerando a especificidade da doação. */
const getPendencia = (uf, taxType) => {
    const registro = (0, exports.getHomologacao)(uf);
    if (!registro)
        return undefined;
    if (taxType === 'DOACAO' && !registro.doacao) {
        // Sem conferência da causa mortis a pendência maior é a da tabela; com ela, o que
        // falta é especificamente a tabela de doação.
        return registro.causaMortis ? PENDENCIA_DOACAO : registro.pendencia;
    }
    return registro.pendencia;
};
exports.getPendencia = getPendencia;
