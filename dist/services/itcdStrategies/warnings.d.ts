import { ItcdReliability, ItcdWarningCategory } from './types';
/** Rótulo curto de cada categoria, para a tela e o documento exportado dizerem o que houve. */
export declare const ITCD_WARNING_LABELS: Record<ItcdWarningCategory, string>;
export declare const avisoTabelaNaoHomologada: (uf: string) => string;
export declare const avisoAliquotaDoacaoNaoHomologada: (uf: string) => string;
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
