import { ItcdReliability, ItcdWarningCategory } from './types';
import { PerfilItcdUf } from './perfilUf';
/** Rótulo curto de cada categoria, para a tela e o documento exportado dizerem o que houve. */
export declare const ITCD_WARNING_LABELS: Record<ItcdWarningCategory, string>;
export declare const avisoTabelaForaDaVigencia: (uf: string, vigenciaDesde: string, dataFatoGerador: string, fonte?: string) => string;
export declare const avisoVigenciaSemData: (uf: string, vigenciaDesde: string, fonte?: string) => string;
/**
 * CALC-03: falta o dado que define o Estado competente. A frase carrega os DOIS marcadores de
 * competência ("competência estimada" e "para determinar a competência"), para cair em
 * COMPETENCIA mesmo que alguém reescreva uma das metades.
 */
export declare const avisoCompetenciaIndeterminada: (dadoFaltante: string, ufProcesso: string, fundamento: string) => string;
/**
 * Revisão 2: de cujus no exterior, parte de um sucessor cuja UF de domicílio não se sabe. Leva os
 * dois marcadores de competência, como `avisoCompetenciaIndeterminada`.
 */
export declare const avisoSucessorSemUf: (nome: string, motivo: "SEM_UF" | "NO_EXTERIOR") => string;
export declare const avisoItcdSemBeneficiarios: (uf: string, base: number) => string;
export declare const avisoDividasNaoAbatidas: (uf: string, fundamento: string) => string;
export declare const avisoAbatimentoControvertido: (uf: string, impostoBaseBruta: number, impostoComTodasAbatidas: number) => string;
export declare const avisoTabelaNaoHomologada: (uf: string) => string;
/**
 * CALC-06: a ressalva de tabela não homologada era a MESMA para as 27 UFs — a do RS (pesquisada
 * em fonte primária) e a do SE (sabidamente errada) eram indistinguíveis. Agora o texto diz em
 * que situação a tabela está. Todas as variantes carregam o marcador M_TABELA, então a
 * categoria continua TABELA_NAO_HOMOLOGADA para quem agrupa por categoria.
 */
export declare const avisoTabelaPorSituacao: (uf: string, perfil: Pick<PerfilItcdUf, "situacaoTabela" | "resumoDivergencia">) => string;
/** CALC-06: o que falta para homologar, conforme a situação da tabela. */
export declare const pendenciaPorSituacao: (perfil: Pick<PerfilItcdUf, "situacaoTabela" | "resumoDivergencia" | "fonteSituacao">) => string;
export declare const avisoAliquotaDoacaoNaoHomologada: (uf: string) => string;
/** CALC-10: UF cuja lei registrada aplica à doação a mesma tabela da causa mortis (GO, art. 78). */
export declare const avisoDoacaoMesmaTabelaPorLei: (uf: string) => string;
export declare const avisoIndiceNaoConferido: (uf: string, nome: string, valor: number, vigenciaInicio?: string) => string;
export declare const avisoIndiceForaDaVigencia: (nome: string, valor: number, vigenciaInicio?: string) => string;
export declare const avisoPrazoDescontoExpirado: (dias: number, dataLimite: string) => string;
export declare const avisoDescontoSemDataDoObito: () => string;
/**
 * Categorias presentes numa mensagem de ressalva (o campo carrega várias frases concatenadas).
 * Texto sem nenhum marcador conhecido volta como OUTRO — nunca como tabela não conferida.
 */
export declare const classifyItcdWarning: (message?: string) => ItcdWarningCategory[];
/** Item de apuração (por UF ou evento de doação) do qual se extraem as ressalvas. */
export interface ItcdWarningSource {
    state?: string;
    warningMessage?: string;
    confiabilidade?: ItcdReliability;
}
/**
 * Agrupa as ressalvas por categoria, com as UFs afetadas. Usado pela tela e pelo DOCX para
 * que o rótulo exibido corresponda ao que de fato aconteceu.
 *
 * A categoria TABELA_NAO_HOMOLOGADA sai do campo estruturado `confiabilidade`, não da
 * presença de texto: ausência de carimbo (cálculo gravado por versão anterior) conta como
 * NÃO conferida — o contrário devolveria um selo de qualidade que ninguém emitiu.
 */
export declare const groupItcdWarningCategories: (itens: ReadonlyArray<ItcdWarningSource>) => Array<{
    categoria: ItcdWarningCategory;
    ufs: string[];
}>;
