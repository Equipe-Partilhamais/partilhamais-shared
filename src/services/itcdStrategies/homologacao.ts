import { UF } from '../../types';
import { ItcdTaxType } from './types';

// Registro de conferência das tabelas de ITCD.
//
// Uma UF só é HOMOLOGADA quando um humano conferiu a alíquota/faixa contra a norma estadual
// vigente e ASSINOU essa conferência aqui: `conferidaPor` + `conferidaEm`. Citar o número da
// lei não basta — o número que está no código é justamente o que a auditoria pôs em dúvida,
// então usá-lo como prova de si mesmo devolveria um selo de qualidade que ninguém emitiu.
// Enquanto a assinatura não existe, o motor continua devolvendo um número (os consumidores
// dependem dele para não quebrar), mas ele sai carimbado como NAO_CONFIGURADA e com aviso
// obrigatório — nunca como valor oficial.
//
// Para homologar uma UF quando o parecer tributário chegar: preencha `normaCitadaNoCodigo`
// com a norma + artigo + início de vigência efetivamente conferidos e monte a conferência
// SEMPRE por `criarConferencia`, que recusa assinatura sem conteúdo. Não invente nem alíquota
// nem citação.
//
// SELO SEM CONTEÚDO NÃO É SELO — decisão registrada: `isHomologada` testava a EXISTÊNCIA do
// objeto de conferência, então gravar `causaMortis: {}` (sem quem conferiu, sem quando, sem
// norma) fazia a UF sair como HOMOLOGADA e apagava o aviso de valor referencial do relatório
// entregue ao cliente. Agora a homologação exige conteúdo válido, e o que não é válido conta
// como PENDENTE (não como erro): o motor segue calculando, sempre com a ressalva.
//
// MODO ESTRITO — decisão registrada: existiu um `calculateItcdForStateStrict` (e o erro
// `ItcdUfNaoConfiguradaError`) que recusava calcular UF não homologada. Foi REMOVIDO por não
// ter nenhum chamador e por lançar em 100% dos casos enquanto nenhuma UF tem conferência
// assinada — um modo que sempre falha não protege ninguém, só some do radar. GATILHO PARA
// REINSTALAR: quando a primeira UF for homologada aqui, vale reintroduzir o estrito como
// invólucro de `calculateItcdForState` (lança quando `confiabilidade !== 'HOMOLOGADA'`), para
// os caminhos que não podem publicar número referencial — emissão de guia, por exemplo.

// Marca de validação. O símbolo não é exportado, então um objeto literal escrito em outro
// arquivo não satisfaz `ConferenciaHumana` para o compilador: quem quiser homologar tem de
// passar por `criarConferencia`. Nenhum campo aqui é opcional — campo opcional esquecido é
// exatamente como o selo vazio silenciava o alerta.
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

const DATA_ISO = /^\d{4}-\d{2}-\d{2}$/;

// A referência precisa citar norma E artigo: "Lei nº 10.705/2000" sozinha não diz o que foi
// conferido, e "art. 16" sozinho não diz de qual norma.
const CITA_NORMA = /(lei|decreto|complementar|constitui|resolu|portaria|regulamento|c[óo]digo)/i;
const CITA_ARTIGO = /\bart(?:s?\.|igos?\b)/i;

const preenchido = (valor: unknown): valor is string =>
    typeof valor === 'string' && valor.trim().length > 0;

/** Data existente no calendário e em AAAA-MM-DD — 2025-02-30 é recusada. */
const dataDeCalendario = (valor: string): boolean => {
    if (!DATA_ISO.test(valor)) return false;
    const data = new Date(`${valor}T00:00:00Z`);
    return !Number.isNaN(data.getTime()) && data.toISOString().slice(0, 10) === valor;
};

// Comparação em UTC: o horário de Brasília está sempre atrás do UTC, então a data de hoje em
// UTC nunca é menor que a local e uma conferência assinada hoje jamais é lida como futura.
const hojeUtc = (): string => new Date().toISOString().slice(0, 10);

/**
 * A conferência tem conteúdo que sirva de prova? Objeto vazio, responsável em branco, data
 * inválida/futura ou referência sem norma e artigo NÃO são conferência: a UF segue pendente.
 */
export const conferenciaValida = (conferencia: unknown): conferencia is ConferenciaHumana => {
    if (!conferencia || typeof conferencia !== 'object') return false;

    const { conferidaPor, conferidaEm, referencia } = conferencia as Partial<ConferenciaEmBranco>;

    if (!preenchido(conferidaPor)) return false;
    // Data futura é erro de digitação ou selo forjado: ninguém conferiu amanhã.
    if (!preenchido(conferidaEm) || !dataDeCalendario(conferidaEm.trim())) return false;
    if (conferidaEm.trim() > hojeUtc()) return false;

    return preenchido(referencia) && CITA_NORMA.test(referencia) && CITA_ARTIGO.test(referencia);
};

/**
 * Única porta de entrada de uma conferência assinada: recusa na hora o que não serve de prova,
 * em vez de deixar o registro nascer inválido e só aparecer lá na frente como "HOMOLOGADA".
 */
export const criarConferencia = (dados: ConferenciaEmBranco): ConferenciaHumana => {
    const conferencia = {
        conferidaPor: dados?.conferidaPor?.trim(),
        conferidaEm: dados?.conferidaEm?.trim(),
        referencia: dados?.referencia?.trim(),
    };

    if (!conferenciaValida(conferencia)) {
        throw new Error(
            'Conferência de ITCD inválida ' +
            `(conferidaPor="${dados?.conferidaPor}", conferidaEm="${dados?.conferidaEm}", referencia="${dados?.referencia}"): ` +
            'exige responsável identificado, data AAAA-MM-DD não futura e referência citando norma e artigo.'
        );
    }

    return conferencia;
};

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

const PENDENCIA_TABELA =
    'Alíquotas/faixas ainda não conferidas contra a lei estadual vigente por um responsável identificado.';
const PENDENCIA_DOACAO =
    'Tabela de doação (inter vivos) ainda não conferida; não há como afirmar que é idêntica à de causa mortis.';

// Nenhuma UF conferida: a auditoria não teve acesso a nenhuma lei estadual e o parecer
// tributário ainda não chegou. As normas abaixo são as que o código já citava no `legalText`
// de cada estratégia — ficam registradas para o conferente saber por onde começar.
export const ITCD_HOMOLOGACAO: Record<UF, UfHomologacao> = {
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

export const getHomologacao = (uf: string): UfHomologacao | undefined => ITCD_HOMOLOGACAO[uf as UF];

/** Conferência assinada para o tipo de fato gerador pedido, quando existir E for válida. */
export const getConferencia = (uf: string, taxType: ItcdTaxType): ConferenciaHumana | undefined => {
    const registro = getHomologacao(uf);
    if (!registro) return undefined;
    const conferencia = taxType === 'DOACAO' ? registro.doacao : registro.causaMortis;
    // O selo é lido pelo conteúdo, não pela presença: quem gravar um objeto sem assinatura
    // (à mão, por cast ou por payload persistido antigo) tem uma UF pendente, não homologada.
    return conferenciaValida(conferencia) ? conferencia : undefined;
};

/**
 * A UF está homologada para o tipo de fato gerador pedido?
 * Só quando a conferência humana está assinada e completa — norma citada no código não homologa
 * nada, e selo sem conteúdo vale o mesmo que selo nenhum. UF fora do registro nunca está.
 */
export const isHomologada = (uf: string, taxType: ItcdTaxType): boolean =>
    !!getConferencia(uf, taxType);

/** UFs pendentes de conferência, para acompanhamento e para o relatório de insumos externos. */
export const listUfsNaoConfiguradas = (taxType: ItcdTaxType): UF[] =>
    (Object.keys(ITCD_HOMOLOGACAO) as UF[]).filter(uf => !isHomologada(uf, taxType));

/** Pendência a exibir para a UF/tipo, já considerando a especificidade da doação. */
export const getPendencia = (uf: string, taxType: ItcdTaxType): string | undefined => {
    const registro = getHomologacao(uf);
    if (!registro) return undefined;
    if (isHomologada(uf, taxType)) return undefined;
    if (taxType === 'DOACAO' && isHomologada(uf, 'CAUSA_MORTIS')) {
        // Com a causa mortis conferida, o que falta é especificamente a tabela de doação.
        return PENDENCIA_DOACAO;
    }
    // Fallback obrigatório: quem grava um selo inválido tende a apagar a `pendencia` junto,
    // e UF sem homologação não pode sair sem dizer o que falta conferir.
    return registro.pendencia ?? PENDENCIA_TABELA;
};
