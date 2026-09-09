"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPendencia = exports.listUfsNaoConfiguradas = exports.isHomologada = exports.getConferencia = exports.getHomologacao = exports.ITCD_HOMOLOGACAO = exports.criarConferencia = exports.conferenciaValida = void 0;
const DATA_ISO = /^\d{4}-\d{2}-\d{2}$/;
// A referência precisa citar norma E artigo: "Lei nº 10.705/2000" sozinha não diz o que foi
// conferido, e "art. 16" sozinho não diz de qual norma.
const CITA_NORMA = /(lei|decreto|complementar|constitui|resolu|portaria|regulamento|c[óo]digo)/i;
const CITA_ARTIGO = /\bart(?:s?\.|igos?\b)/i;
const preenchido = (valor) => typeof valor === 'string' && valor.trim().length > 0;
/** Data existente no calendário e em AAAA-MM-DD — 2025-02-30 é recusada. */
const dataDeCalendario = (valor) => {
    if (!DATA_ISO.test(valor))
        return false;
    const data = new Date(`${valor}T00:00:00Z`);
    return !Number.isNaN(data.getTime()) && data.toISOString().slice(0, 10) === valor;
};
// Comparação em UTC: o horário de Brasília está sempre atrás do UTC, então a data de hoje em
// UTC nunca é menor que a local e uma conferência assinada hoje jamais é lida como futura.
const hojeUtc = () => new Date().toISOString().slice(0, 10);
/**
 * A conferência tem conteúdo que sirva de prova? Objeto vazio, responsável em branco, data
 * inválida/futura ou referência sem norma e artigo NÃO são conferência: a UF segue pendente.
 */
const conferenciaValida = (conferencia) => {
    if (!conferencia || typeof conferencia !== 'object')
        return false;
    const { conferidaPor, conferidaEm, referencia } = conferencia;
    if (!preenchido(conferidaPor))
        return false;
    // Data futura é erro de digitação ou selo forjado: ninguém conferiu amanhã.
    if (!preenchido(conferidaEm) || !dataDeCalendario(conferidaEm.trim()))
        return false;
    if (conferidaEm.trim() > hojeUtc())
        return false;
    return preenchido(referencia) && CITA_NORMA.test(referencia) && CITA_ARTIGO.test(referencia);
};
exports.conferenciaValida = conferenciaValida;
/**
 * Única porta de entrada de uma conferência assinada: recusa na hora o que não serve de prova,
 * em vez de deixar o registro nascer inválido e só aparecer lá na frente como "HOMOLOGADA".
 */
const criarConferencia = (dados) => {
    const conferencia = {
        conferidaPor: dados?.conferidaPor?.trim(),
        conferidaEm: dados?.conferidaEm?.trim(),
        referencia: dados?.referencia?.trim(),
    };
    if (!(0, exports.conferenciaValida)(conferencia)) {
        throw new Error('Conferência de ITCD inválida ' +
            `(conferidaPor="${dados?.conferidaPor}", conferidaEm="${dados?.conferidaEm}", referencia="${dados?.referencia}"): ` +
            'exige responsável identificado, data AAAA-MM-DD não futura e referência citando norma e artigo.');
    }
    return conferencia;
};
exports.criarConferencia = criarConferencia;
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
/** Conferência assinada para o tipo de fato gerador pedido, quando existir E for válida. */
const getConferencia = (uf, taxType) => {
    const registro = (0, exports.getHomologacao)(uf);
    if (!registro)
        return undefined;
    const conferencia = taxType === 'DOACAO' ? registro.doacao : registro.causaMortis;
    // O selo é lido pelo conteúdo, não pela presença: quem gravar um objeto sem assinatura
    // (à mão, por cast ou por payload persistido antigo) tem uma UF pendente, não homologada.
    return (0, exports.conferenciaValida)(conferencia) ? conferencia : undefined;
};
exports.getConferencia = getConferencia;
/**
 * A UF está homologada para o tipo de fato gerador pedido?
 * Só quando a conferência humana está assinada e completa — norma citada no código não homologa
 * nada, e selo sem conteúdo vale o mesmo que selo nenhum. UF fora do registro nunca está.
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
    if ((0, exports.isHomologada)(uf, taxType))
        return undefined;
    if (taxType === 'DOACAO' && (0, exports.isHomologada)(uf, 'CAUSA_MORTIS')) {
        // Com a causa mortis conferida, o que falta é especificamente a tabela de doação.
        return PENDENCIA_DOACAO;
    }
    // Fallback obrigatório: quem grava um selo inválido tende a apagar a `pendencia` junto,
    // e UF sem homologação não pode sair sem dizer o que falta conferir.
    return registro.pendencia ?? PENDENCIA_TABELA;
};
exports.getPendencia = getPendencia;
