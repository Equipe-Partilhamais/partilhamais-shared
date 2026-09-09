"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.groupItcdWarningCategories = exports.classifyItcdWarning = exports.avisoDescontoSemDataDoObito = exports.avisoPrazoDescontoExpirado = exports.avisoIndiceForaDaVigencia = exports.avisoIndiceNaoConferido = exports.avisoAliquotaDoacaoNaoHomologada = exports.avisoTabelaNaoHomologada = exports.ITCD_WARNING_LABELS = void 0;
/**
 * Composição e classificação das ressalvas do ITCD.
 *
 * O motor entrega todos os avisos num único `warningMessage`, e o consumidor chamava
 * qualquer um deles de "tabela não conferida contra a lei estadual" — rótulo errado para
 * um aviso de prazo de desconto ou de competência. As frases NASCEM aqui (builders) e são
 * RECONHECIDAS aqui (marcadores): quem mudar o texto muda o rótulo junto, e a tela não
 * volta a rotular errado.
 */
// Trecho invariável de cada frase: é o que o builder interpola e o que o classificador procura.
const M_TABELA = 'não está homologada no PartilhaMais';
const M_ALIQUOTA_DOACAO = 'Alíquota de doação não homologada';
const M_INDICE_NAO_CONFERIDO = 'é referencial e não foi conferido na SEFAZ';
const M_INDICE_FORA_DA_VIGENCIA = 'não cobre a data do fato gerador';
const M_PRAZO_EXPIRADO = 'para desconto expirou em';
const M_PRAZO_SEM_DATA = 'Desconto não calculado';
// Estes dois são compostos FORA do motor, na resolução de competência dos arts. 158/159
// (calculationService do front e do back). Ficam registrados aqui porque é aqui que o
// consumidor pergunta "de que tipo é esta ressalva"; sem o registro, um aviso de competência
// cairia em OUTRO e voltaria a ser exibido sob o rótulo de tabela não conferida.
const M_COMPETENCIA_SUCESSOR = 'para determinar a competência';
const M_COMPETENCIA_ESTIMADA = 'competência estimada';
const MARCADORES = [
    { categoria: 'TABELA_NAO_HOMOLOGADA', marcador: M_TABELA },
    { categoria: 'TABELA_NAO_HOMOLOGADA', marcador: M_ALIQUOTA_DOACAO },
    { categoria: 'INDICE_FISCAL', marcador: M_INDICE_NAO_CONFERIDO },
    { categoria: 'INDICE_FISCAL', marcador: M_INDICE_FORA_DA_VIGENCIA },
    { categoria: 'COMPETENCIA', marcador: M_COMPETENCIA_SUCESSOR },
    { categoria: 'COMPETENCIA', marcador: M_COMPETENCIA_ESTIMADA },
    { categoria: 'PRAZO', marcador: M_PRAZO_EXPIRADO },
    { categoria: 'PRAZO', marcador: M_PRAZO_SEM_DATA },
];
/** Rótulo curto de cada categoria, para a tela e o documento exportado dizerem o que houve. */
exports.ITCD_WARNING_LABELS = {
    TABELA_NAO_HOMOLOGADA: 'a tabela de ITCD não foi conferida contra a lei estadual vigente',
    INDICE_FISCAL: 'a unidade fiscal usada não foi conferida ou não cobre a data do fato gerador',
    COMPETENCIA: 'a competência do imposto depende de dado que ainda não foi informado',
    PRAZO: 'há prazo de desconto vencido ou não apurado',
    OUTRO: 'há ressalva registrada pelo motor de cálculo',
};
const descreveIndice = (valor, vigenciaInicio) => `R$ ${valor.toFixed(2)}${vigenciaInicio ? `, vigência ${vigenciaInicio}` : ''}`;
const avisoTabelaNaoHomologada = (uf) => `Valor referencial: a tabela de ITCD de ${uf} ${M_TABELA}. Confirme a alíquota vigente na SEFAZ/${uf} antes de usar.`;
exports.avisoTabelaNaoHomologada = avisoTabelaNaoHomologada;
const avisoAliquotaDoacaoNaoHomologada = (uf) => `${M_ALIQUOTA_DOACAO} para ${uf}: valor calculado com a regra de causa mortis.`;
exports.avisoAliquotaDoacaoNaoHomologada = avisoAliquotaDoacaoNaoHomologada;
const avisoIndiceNaoConferido = (uf, nome, valor, vigenciaInicio) => `Valor de ${nome} (${descreveIndice(valor, vigenciaInicio)}) ${M_INDICE_NAO_CONFERIDO}/${uf}.`;
exports.avisoIndiceNaoConferido = avisoIndiceNaoConferido;
const avisoIndiceForaDaVigencia = (nome, valor, vigenciaInicio) => `Valor de ${nome} usado (${descreveIndice(valor, vigenciaInicio)}) ${M_INDICE_FORA_DA_VIGENCIA}. Confirme o índice da competência.`;
exports.avisoIndiceForaDaVigencia = avisoIndiceForaDaVigencia;
const avisoPrazoDescontoExpirado = (dias, dataLimite) => `Prazo de ${dias} dias ${M_PRAZO_EXPIRADO} ${dataLimite}.`;
exports.avisoPrazoDescontoExpirado = avisoPrazoDescontoExpirado;
const avisoDescontoSemDataDoObito = () => `Data do óbito não informada. ${M_PRAZO_SEM_DATA}.`;
exports.avisoDescontoSemDataDoObito = avisoDescontoSemDataDoObito;
/**
 * Categorias presentes numa mensagem de ressalva (o campo carrega várias frases concatenadas).
 * Texto sem nenhum marcador conhecido volta como OUTRO — nunca como tabela não conferida.
 */
const classifyItcdWarning = (message) => {
    if (!message)
        return [];
    const encontradas = MARCADORES
        .filter(item => message.includes(item.marcador))
        .map(item => item.categoria);
    const unicas = Array.from(new Set(encontradas));
    return unicas.length > 0 ? unicas : ['OUTRO'];
};
exports.classifyItcdWarning = classifyItcdWarning;
// Da mais grave para a menos: é a ordem em que a tela e o documento listam as ressalvas.
const ORDEM_CATEGORIAS = [
    'TABELA_NAO_HOMOLOGADA',
    'INDICE_FISCAL',
    'COMPETENCIA',
    'PRAZO',
    'OUTRO',
];
/**
 * Agrupa as ressalvas por categoria, com as UFs afetadas. Usado pela tela e pelo DOCX para
 * que o rótulo exibido corresponda ao que de fato aconteceu.
 *
 * A categoria TABELA_NAO_HOMOLOGADA sai do campo estruturado `confiabilidade`, não da
 * presença de texto: ausência de carimbo (cálculo gravado por versão anterior) conta como
 * NÃO conferida — o contrário devolveria um selo de qualidade que ninguém emitiu.
 */
const groupItcdWarningCategories = (itens) => {
    const porCategoria = new Map();
    itens.forEach(item => {
        const categorias = new Set((0, exports.classifyItcdWarning)(item.warningMessage));
        if (item.confiabilidade !== 'HOMOLOGADA')
            categorias.add('TABELA_NAO_HOMOLOGADA');
        categorias.forEach(categoria => {
            const ufs = porCategoria.get(categoria) || new Set();
            if (item.state)
                ufs.add(item.state);
            porCategoria.set(categoria, ufs);
        });
    });
    return ORDEM_CATEGORIAS
        .filter(categoria => porCategoria.has(categoria))
        .map(categoria => ({
        categoria,
        ufs: Array.from(porCategoria.get(categoria)).sort(),
    }));
};
exports.groupItcdWarningCategories = groupItcdWarningCategories;
