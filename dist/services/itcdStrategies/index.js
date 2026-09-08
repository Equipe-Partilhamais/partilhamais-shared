"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculateItcdForStateStrict = exports.calculateItcdForState = void 0;
const types_1 = require("./types");
const homologacao_1 = require("./homologacao");
const MG_1 = require("./states/MG");
const SP_1 = require("./states/SP");
const RJ_1 = require("./states/RJ");
const SC_1 = require("./states/SC");
const RS_1 = require("./states/RS");
const DF_1 = require("./states/DF");
const ES_1 = require("./states/ES");
const AC_1 = require("./states/AC");
const AL_1 = require("./states/AL");
const AM_1 = require("./states/AM");
const AP_1 = require("./states/AP");
const BA_1 = require("./states/BA");
const CE_1 = require("./states/CE");
const GO_1 = require("./states/GO");
const MA_1 = require("./states/MA");
const MT_1 = require("./states/MT");
const MS_1 = require("./states/MS");
const PA_1 = require("./states/PA");
const PB_1 = require("./states/PB");
const PE_1 = require("./states/PE");
const PI_1 = require("./states/PI");
const PR_1 = require("./states/PR");
const RN_1 = require("./states/RN");
const RO_1 = require("./states/RO");
const RR_1 = require("./states/RR");
const SE_1 = require("./states/SE");
const TO_1 = require("./states/TO");
const Default_1 = require("./states/Default");
__exportStar(require("./homologacao"), exports);
__exportStar(require("./types"), exports);
const strategies = {
    'AC': AC_1.ACStrategy,
    'AL': AL_1.ALStrategy,
    'AM': AM_1.AMStrategy,
    'AP': AP_1.APStrategy,
    'BA': BA_1.BAStrategy,
    'CE': CE_1.CEStrategy,
    'DF': DF_1.DFStrategy,
    'ES': ES_1.ESStrategy,
    'GO': GO_1.GOStrategy,
    'MA': MA_1.MAStrategy,
    'MG': MG_1.MGStrategy,
    'MS': MS_1.MSStrategy,
    'MT': MT_1.MTStrategy,
    'PA': PA_1.PAStrategy,
    'PB': PB_1.PBStrategy,
    'PE': PE_1.PEStrategy,
    'PI': PI_1.PIStrategy,
    'PR': PR_1.PRStrategy,
    'RJ': RJ_1.RJStrategy,
    'RN': RN_1.RNStrategy,
    'RO': RO_1.ROStrategy,
    'RR': RR_1.RRStrategy,
    'RS': RS_1.RSStrategy,
    'SC': SC_1.SCStrategy,
    'SE': SE_1.SEStrategy,
    'SP': SP_1.SPStrategy,
    'TO': TO_1.TOStrategy
};
const appendWarning = (current, extra) => [current, extra].filter(Boolean).join(' ').trim();
/**
 * Carimba o resultado da estratégia com a confiabilidade da tabela e com os avisos que o
 * consumidor é obrigado a exibir. Fica aqui, e não em cada UF, para que nenhuma estratégia
 * possa "esquecer" de se declarar não homologada.
 */
const stampReliability = (uf, taxType, result) => {
    const registro = (0, homologacao_1.getHomologacao)(uf);
    const homologada = (0, homologacao_1.isHomologada)(uf, taxType);
    const confiabilidade = homologada ? 'HOMOLOGADA' : 'NAO_CONFIGURADA';
    let warningMessage = result.warningMessage;
    let pendenciaHomologacao;
    if (!homologada) {
        if (!registro) {
            pendenciaHomologacao = `UF "${uf}" sem estratégia própria; cálculo feito pela regra padrão nacional (4%).`;
        }
        else {
            pendenciaHomologacao = registro.pendencia;
        }
        if (taxType === 'DOACAO') {
            // O motor devolve o número da regra de causa mortis; sem este aviso o usuário
            // recebe um cálculo de doação com alíquota que ninguém conferiu.
            warningMessage = appendWarning(warningMessage, `Alíquota de doação não homologada para ${uf}: valor calculado com a regra de causa mortis.`);
        }
        warningMessage = appendWarning(warningMessage, `Valor referencial: a tabela de ITCD de ${uf} não está homologada no PartilhaMais. Confirme a alíquota vigente na SEFAZ/${uf} antes de usar.`);
    }
    // A unidade fiscal tem de ser a vigente na data do fato gerador; quando a série não cobre
    // essa data o número sai do último ponto conhecido e isso precisa aparecer.
    const unidade = result.fiscalUnitUsed;
    if (unidade?.outdated) {
        warningMessage = appendWarning(warningMessage, `Valor de ${unidade.name} usado (R$ ${unidade.value.toFixed(2)}${unidade.vigenciaInicio ? `, vigência ${unidade.vigenciaInicio}` : ''}) não cobre a data do fato gerador. Confirme o índice da competência.`);
    }
    return {
        ...result,
        confiabilidade,
        warningMessage: warningMessage || undefined,
        pendenciaHomologacao,
    };
};
const calculateItcdForState = (uf, baseValue, settings, deathDate, taxType = 'CAUSA_MORTIS') => {
    const strategy = strategies[uf] || Default_1.DefaultStrategy;
    return stampReliability(uf, taxType, strategy.calculate({ baseValue, settings, deathDate, taxType }));
};
exports.calculateItcdForState = calculateItcdForState;
/**
 * Mesma conta, mas recusa devolver número para UF/tipo sem tabela homologada.
 * Use nos fluxos que produzem documento oficial (guia, escritura, petição).
 */
const calculateItcdForStateStrict = (uf, baseValue, settings, deathDate, taxType = 'CAUSA_MORTIS') => {
    const result = (0, exports.calculateItcdForState)(uf, baseValue, settings, deathDate, taxType);
    if (result.confiabilidade !== 'HOMOLOGADA') {
        throw new types_1.ItcdUfNaoConfiguradaError(uf, taxType, result.pendenciaHomologacao);
    }
    return result;
};
exports.calculateItcdForStateStrict = calculateItcdForStateStrict;
