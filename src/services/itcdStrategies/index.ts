
import { UF } from '../../types';
import { ItcdStrategy, ItcdTaxType } from './types';
import { MGStrategy } from './states/MG';
import { SPStrategy } from './states/SP';
import { RJStrategy } from './states/RJ';
import { SCStrategy } from './states/SC';
import { RSStrategy } from './states/RS';
import { DFStrategy } from './states/DF';
import { ESStrategy } from './states/ES';
import { ACStrategy } from './states/AC';
import { ALStrategy } from './states/AL';
import { AMStrategy } from './states/AM';
import { APStrategy } from './states/AP';
import { BAStrategy } from './states/BA';
import { CEStrategy } from './states/CE';
import { GOStrategy } from './states/GO';
import { MAStrategy } from './states/MA';
import { MTStrategy } from './states/MT';
import { MSStrategy } from './states/MS';
import { PAStrategy } from './states/PA';
import { PBStrategy } from './states/PB';
import { PEStrategy } from './states/PE';
import { PIStrategy } from './states/PI';
import { PRStrategy } from './states/PR';
import { RNStrategy } from './states/RN';
import { ROStrategy } from './states/RO';
import { RRStrategy } from './states/RR';
import { SEStrategy } from './states/SE';
import { TOStrategy } from './states/TO';
import { DefaultStrategy } from './states/Default';

const strategies: Record<string, ItcdStrategy> = {
    'AC': ACStrategy,
    'AL': ALStrategy,
    'AM': AMStrategy,
    'AP': APStrategy,
    'BA': BAStrategy,
    'CE': CEStrategy,
    'DF': DFStrategy,
    'ES': ESStrategy,
    'GO': GOStrategy,
    'MA': MAStrategy,
    'MG': MGStrategy,
    'MS': MSStrategy,
    'MT': MTStrategy,
    'PA': PAStrategy,
    'PB': PBStrategy,
    'PE': PEStrategy,
    'PI': PIStrategy,
    'PR': PRStrategy,
    'RJ': RJStrategy,
    'RN': RNStrategy,
    'RO': ROStrategy,
    'RR': RRStrategy,
    'RS': RSStrategy,
    'SC': SCStrategy,
    'SE': SEStrategy,
    'SP': SPStrategy,
    'TO': TOStrategy
};

export const calculateItcdForState = (uf: UF, baseValue: number, settings: any, deathDate?: string, taxType: ItcdTaxType = 'CAUSA_MORTIS') => {
    const strategy = strategies[uf] || DefaultStrategy;
    return strategy.calculate({ baseValue, settings, deathDate, taxType });
};
