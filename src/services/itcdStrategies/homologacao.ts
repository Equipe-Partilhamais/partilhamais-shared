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
// com a norma + artigo + início de vigência efetivamente conferidos e `conferidaPor`/
// `conferidaEm` com quem conferiu e quando. Não invente nem alíquota nem citação.

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

/** Conferência assinada para o tipo de fato gerador pedido, quando existir. */
export const getConferencia = (uf: string, taxType: ItcdTaxType): ConferenciaHumana | undefined => {
    const registro = getHomologacao(uf);
    if (!registro) return undefined;
    return taxType === 'DOACAO' ? registro.doacao : registro.causaMortis;
};

/**
 * A UF está homologada para o tipo de fato gerador pedido?
 * Só quando a conferência humana está assinada — norma citada no código não homologa nada.
 * UF fora do registro nunca está.
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
    if (taxType === 'DOACAO' && !registro.doacao) {
        // Sem conferência da causa mortis a pendência maior é a da tabela; com ela, o que
        // falta é especificamente a tabela de doação.
        return registro.causaMortis ? PENDENCIA_DOACAO : registro.pendencia;
    }
    return registro.pendencia;
};
