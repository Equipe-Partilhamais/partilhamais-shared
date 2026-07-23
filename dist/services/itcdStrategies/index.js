"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculateItcdForState = void 0;
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
const calculateItcdForState = (uf, baseValue, settings, deathDate, taxType = 'CAUSA_MORTIS') => {
    const strategy = strategies[uf] || Default_1.DefaultStrategy;
    return strategy.calculate({ baseValue, settings, deathDate, taxType });
};
exports.calculateItcdForState = calculateItcdForState;
