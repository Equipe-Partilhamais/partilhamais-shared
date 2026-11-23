"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.groupItcdWarningCategories = exports.classifyItcdWarning = exports.avisoDescontoSemDataDoObito = exports.avisoPrazoDescontoExpirado = exports.avisoIndiceForaDaVigencia = exports.avisoIndiceNaoConferido = exports.avisoDoacaoMesmaTabelaPorLei = exports.avisoAliquotaDoacaoNaoHomologada = exports.pendenciaPorSituacao = exports.avisoTabelaPorSituacao = exports.avisoTabelaNaoHomologada = exports.avisoAbatimentoControvertido = exports.avisoDividasNaoAbatidas = exports.avisoItcdSemBeneficiarios = exports.avisoSucessorSemUf = exports.avisoCompetenciaIndeterminada = exports.avisoVigenciaSemData = exports.avisoTabelaForaDaVigencia = exports.ITCD_WARNING_LABELS = void 0;
const formatters_1 = require("../../utils/formatters");
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
// Compostos pelo motor de partilha (`services/partilha`), ao montar a base de cada UF.
const M_SEM_BENEFICIARIOS = 'sem beneficiário para ratear a base';
const M_DIVIDAS_NAO_ABATIDAS = 'as dívidas não são abatidas da base do ITCD';
const M_ABATIMENTO_CONTROVERTIDO = 'abatimento de dívidas na base do ITCD não tem regra registrada';
// Vigência da tabela codificada (revisão): fato gerador anterior ao início registrado, ou sem data.
const M_TABELA_FORA_DA_VIGENCIA = 'anterior ao início de vigência da tabela codificada';
const M_VIGENCIA_SEM_DATA = 'sem a data do fato gerador não há como conferir a vigência da tabela';
const MARCADORES = [
    { categoria: 'TABELA_NAO_HOMOLOGADA', marcador: M_TABELA },
    { categoria: 'TABELA_NAO_HOMOLOGADA', marcador: M_ALIQUOTA_DOACAO },
    { categoria: 'TABELA_NAO_HOMOLOGADA', marcador: M_TABELA_FORA_DA_VIGENCIA },
    { categoria: 'TABELA_NAO_HOMOLOGADA', marcador: M_VIGENCIA_SEM_DATA },
    { categoria: 'INDICE_FISCAL', marcador: M_INDICE_NAO_CONFERIDO },
    { categoria: 'INDICE_FISCAL', marcador: M_INDICE_FORA_DA_VIGENCIA },
    { categoria: 'COMPETENCIA', marcador: M_COMPETENCIA_SUCESSOR },
    { categoria: 'COMPETENCIA', marcador: M_COMPETENCIA_ESTIMADA },
    { categoria: 'BASE_CALCULO', marcador: M_SEM_BENEFICIARIOS },
    { categoria: 'BASE_CALCULO', marcador: M_DIVIDAS_NAO_ABATIDAS },
    { categoria: 'BASE_CALCULO', marcador: M_ABATIMENTO_CONTROVERTIDO },
    { categoria: 'PRAZO', marcador: M_PRAZO_EXPIRADO },
    { categoria: 'PRAZO', marcador: M_PRAZO_SEM_DATA },
];
/** Rótulo curto de cada categoria, para a tela e o documento exportado dizerem o que houve. */
exports.ITCD_WARNING_LABELS = {
    TABELA_NAO_HOMOLOGADA: 'a tabela de ITCD não foi conferida contra a lei estadual vigente',
    INDICE_FISCAL: 'a unidade fiscal usada não foi conferida ou não cobre a data do fato gerador',
    COMPETENCIA: 'a competência do imposto depende de dado que ainda não foi informado',
    BASE_CALCULO: 'a base de cálculo depende de regra não registrada ou de dado que falta no caso',
    PRAZO: 'há prazo de desconto vencido ou não apurado',
    OUTRO: 'há ressalva registrada pelo motor de cálculo',
};
const reais = (valor) => (0, formatters_1.formatCurrency)(valor);
/** AAAA-MM-DD → DD/MM/AAAA, sem depender do locale do Node. */
const dataBR = (iso) => {
    const [a, m, d] = iso.slice(0, 10).split('-');
    return `${d}/${m}/${a}`;
};
const avisoTabelaForaDaVigencia = (uf, vigenciaDesde, dataFatoGerador, fonte) => `ITCD de ${uf} INDETERMINADO: o fato gerador (${dataBR(dataFatoGerador)}) é ${M_TABELA_FORA_DA_VIGENCIA} ` +
    `(${dataBR(vigenciaDesde)}${fonte ? ` — ${fonte}` : ''}). A tabela aplicável nessa data não está no PartilhaMais: o valor ` +
    `exibido é o da tabela atual, só como referência, e não vale para este fato gerador.`;
exports.avisoTabelaForaDaVigencia = avisoTabelaForaDaVigencia;
const avisoVigenciaSemData = (uf, vigenciaDesde, fonte) => `A tabela de ITCD de ${uf} codificada vale desde ${dataBR(vigenciaDesde)}${fonte ? ` (${fonte})` : ''}; ` +
    `${M_VIGENCIA_SEM_DATA}. Informe a data do óbito.`;
exports.avisoVigenciaSemData = avisoVigenciaSemData;
/**
 * CALC-03: falta o dado que define o Estado competente. A frase carrega os DOIS marcadores de
 * competência ("competência estimada" e "para determinar a competência"), para cair em
 * COMPETENCIA mesmo que alguém reescreva uma das metades.
 */
const avisoCompetenciaIndeterminada = (dadoFaltante, ufProcesso, fundamento) => `Competência indeterminada: ${dadoFaltante} não foi informado, e é ele que define o Estado competente (${fundamento}). ` +
    `O valor desta UF está com ${M_COMPETENCIA_ESTIMADA} pela UF do processo (${ufProcesso}) apenas como referência; ` +
    `informe o dado ${M_COMPETENCIA_SUCESSOR} antes de recolher o imposto ou gerar a minuta.`;
exports.avisoCompetenciaIndeterminada = avisoCompetenciaIndeterminada;
/**
 * Revisão 2: de cujus no exterior, parte de um sucessor cuja UF de domicílio não se sabe. Leva os
 * dois marcadores de competência, como `avisoCompetenciaIndeterminada`.
 */
const avisoSucessorSemUf = (nome, motivo) => motivo === 'NO_EXTERIOR'
    ? `Sucessor ${nome} domiciliado no exterior: com o de cujus também no exterior, a competência sobre a parte dele segue ` +
        `a localização do bem no Brasil (LC 227/2026, art. 159, V), que o cadastro não informa — ${M_COMPETENCIA_ESTIMADA} ` +
        `apenas como referência; informe a localização do bem ${M_COMPETENCIA_SUCESSOR}.`
    : `Sucessor ${nome} sem UF de domicílio informada: a competência sobre a parte dele nos bens que seguem o domicílio do ` +
        `sucessor (LC 227/2026, arts. 158, III, e 159, II) não pode ser determinada — ${M_COMPETENCIA_ESTIMADA} apenas como ` +
        `referência; informe a UF de residência na qualificação ${M_COMPETENCIA_SUCESSOR}.`;
exports.avisoSucessorSemUf = avisoSucessorSemUf;
const avisoItcdSemBeneficiarios = (uf, base) => `ITCD de ${uf} não calculado: ${M_SEM_BENEFICIARIOS} de ${reais(base)} — nenhum herdeiro ou legatário recebe quinhão ` +
    `neste cálculo (CTN, art. 35, parágrafo único). Cadastre os herdeiros antes de usar o valor.`;
exports.avisoItcdSemBeneficiarios = avisoItcdSemBeneficiarios;
const avisoDividasNaoAbatidas = (uf, fundamento) => `Em ${uf} ${M_DIVIDAS_NAO_ABATIDAS}, qualquer que seja o tratamento escolhido para a dívida (${fundamento}). ` +
    `Há decisões judiciais admitindo o abatimento de dívida comprovada; adotar essa tese é decisão do advogado e, ` +
    `em regra, depende de medida judicial.`;
exports.avisoDividasNaoAbatidas = avisoDividasNaoAbatidas;
const avisoAbatimentoControvertido = (uf, impostoBaseBruta, impostoComTodasAbatidas) => `Em ${uf} o ${M_ABATIMENTO_CONTROVERTIDO} no PartilhaMais: o cálculo seguiu o tratamento escolhido para cada dívida. ` +
    `Sem abater nenhuma dívida o ITCD seria ${reais(impostoBaseBruta)}; abatendo todas, ${reais(impostoComTodasAbatidas)}. ` +
    `Confirme a regra da SEFAZ/${uf} antes de usar.`;
exports.avisoAbatimentoControvertido = avisoAbatimentoControvertido;
const descreveIndice = (valor, vigenciaInicio) => `R$ ${valor.toFixed(2)}${vigenciaInicio ? `, vigência ${vigenciaInicio}` : ''}`;
const avisoTabelaNaoHomologada = (uf) => `Valor referencial: a tabela de ITCD de ${uf} ${M_TABELA}. Confirme a alíquota vigente na SEFAZ/${uf} antes de usar.`;
exports.avisoTabelaNaoHomologada = avisoTabelaNaoHomologada;
/**
 * CALC-06: a ressalva de tabela não homologada era a MESMA para as 27 UFs — a do RS (pesquisada
 * em fonte primária) e a do SE (sabidamente errada) eram indistinguíveis. Agora o texto diz em
 * que situação a tabela está. Todas as variantes carregam o marcador M_TABELA, então a
 * categoria continua TABELA_NAO_HOMOLOGADA para quem agrupa por categoria.
 */
const avisoTabelaPorSituacao = (uf, perfil) => {
    switch (perfil.situacaoTabela) {
        case 'DIVERGENCIA_CONHECIDA':
            return (`DIVERGÊNCIA CONHECIDA: a tabela de ITCD de ${uf} ${M_TABELA} e o valor calculado NÃO corresponde à lei estadual` +
                `${perfil.resumoDivergencia ? ` — ${perfil.resumoDivergencia}` : '.'} Refaça o cálculo pela lei (SEFAZ/${uf}) antes de recolher ` +
                `o imposto ou de usar o valor na minuta.`);
        case 'PESQUISADA':
            return (`Valor referencial: a tabela de ITCD de ${uf} ${M_TABELA}. As faixas foram pesquisadas na lei estadual, mas a ` +
                `conferência ainda não foi assinada por um responsável. Confirme a alíquota vigente na SEFAZ/${uf} antes de usar.`);
        case 'FAIXAS_ESTIMADAS':
            return (`Faixas sem fonte legal registrada: a tabela de ITCD de ${uf} ${M_TABELA} e as faixas usadas foram estimadas. ` +
                `Confirme a alíquota vigente na SEFAZ/${uf} antes de usar.`);
        default:
            return (`Valor referencial: a tabela de ITCD de ${uf} ${M_TABELA}; a alíquota usada é de referência, sem pesquisa da lei ` +
                `estadual registrada. Confirme a alíquota vigente na SEFAZ/${uf} antes de usar.`);
    }
};
exports.avisoTabelaPorSituacao = avisoTabelaPorSituacao;
/** CALC-06: o que falta para homologar, conforme a situação da tabela. */
const pendenciaPorSituacao = (perfil) => {
    switch (perfil.situacaoTabela) {
        case 'DIVERGENCIA_CONHECIDA':
            return `A tabela do código diverge da lei estadual (${perfil.fonteSituacao}). Corrigir a estratégia pela lei antes de qualquer conferência.`;
        case 'PESQUISADA':
            return `Tabela pesquisada em fonte primária (${perfil.fonteSituacao}); falta a conferência assinada por um responsável identificado.`;
        case 'FAIXAS_ESTIMADAS':
            return `Faixas sem fonte legal (${perfil.fonteSituacao}). Pesquisar a lei estadual e codificar as faixas antes da conferência.`;
        default:
            return `Alíquota de referência sem pesquisa registrada (${perfil.fonteSituacao}). Conferir contra a lei estadual vigente por um responsável identificado.`;
    }
};
exports.pendenciaPorSituacao = pendenciaPorSituacao;
const avisoAliquotaDoacaoNaoHomologada = (uf) => `${M_ALIQUOTA_DOACAO} para ${uf}: valor calculado com a regra de causa mortis.`;
exports.avisoAliquotaDoacaoNaoHomologada = avisoAliquotaDoacaoNaoHomologada;
/** CALC-10: UF cuja lei registrada aplica à doação a mesma tabela da causa mortis (GO, art. 78). */
const avisoDoacaoMesmaTabelaPorLei = (uf) => `${M_ALIQUOTA_DOACAO} para ${uf}: a lei registrada no PartilhaMais aplica à doação a mesma tabela da causa mortis.`;
exports.avisoDoacaoMesmaTabelaPorLei = avisoDoacaoMesmaTabelaPorLei;
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
    'BASE_CALCULO',
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
