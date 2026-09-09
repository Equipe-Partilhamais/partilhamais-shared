
import { UF } from '../../types';
import { ItcdStrategy, ItcdTaxType, ItcdResult, ItcdReliability } from './types';
import { getHomologacao, getPendencia, isHomologada } from './homologacao';
import {
    avisoAliquotaDoacaoNaoHomologada,
    avisoIndiceForaDaVigencia,
    avisoIndiceNaoConferido,
    avisoTabelaNaoHomologada,
} from './warnings';
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

export * from './homologacao';
export * from './types';
export * from './warnings';

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

const appendWarning = (current: string | undefined, extra: string): string =>
    [current, extra].filter(Boolean).join(' ').trim();

/**
 * Carimba o resultado da estratégia com a confiabilidade da tabela e com os avisos que o
 * consumidor é obrigado a exibir. Fica aqui, e não em cada UF, para que nenhuma estratégia
 * possa "esquecer" de se declarar não homologada.
 */
const stampReliability = (uf: string, taxType: ItcdTaxType, result: ItcdResult): ItcdResult => {
    const registro = getHomologacao(uf);
    const homologada = isHomologada(uf, taxType);
    const confiabilidade: ItcdReliability = homologada ? 'HOMOLOGADA' : 'NAO_CONFIGURADA';

    let warningMessage = result.warningMessage;
    let pendenciaHomologacao: string | undefined;

    if (!homologada) {
        if (!registro) {
            pendenciaHomologacao = `UF "${uf}" sem estratégia própria; cálculo feito pela regra padrão nacional (4%).`;
        } else {
            pendenciaHomologacao = getPendencia(uf, taxType);
        }

        if (taxType === 'DOACAO') {
            // O motor devolve o número da regra de causa mortis; sem este aviso o usuário
            // recebe um cálculo de doação com alíquota que ninguém conferiu.
            warningMessage = appendWarning(warningMessage, avisoAliquotaDoacaoNaoHomologada(uf));
        }

        warningMessage = appendWarning(warningMessage, avisoTabelaNaoHomologada(uf));
    }

    const unidade = result.fiscalUnitUsed;
    if (unidade) {
        // "Cobrir a data do fato gerador" e "estar conferido" são coisas diferentes. A série de
        // hoje tem um único ponto por UF, que ninguém conferiu: se o aviso dependesse só de
        // `outdated`, o óbito de 2025 — o caso mais comum — sairia sem ressalva nenhuma sobre um
        // índice que determina o enquadramento da faixa (no RJ, 6% ou 8%).
        // `!== true` e não `=== false`: dado ausente (payload persistido antigo, estratégia
        // que venha a montar o objeto fora do tipo) significa RESSALVA, não silêncio.
        if (unidade.conferida !== true) {
            warningMessage = appendWarning(
                warningMessage,
                avisoIndiceNaoConferido(uf, unidade.name, unidade.value, unidade.vigenciaInicio)
            );
        }
        // A unidade fiscal tem de ser a vigente na data do fato gerador; quando a série não
        // cobre essa data o número sai do último ponto conhecido e isso precisa aparecer.
        if (unidade.outdated) {
            warningMessage = appendWarning(
                warningMessage,
                avisoIndiceForaDaVigencia(unidade.name, unidade.value, unidade.vigenciaInicio)
            );
        }
    }

    return {
        ...result,
        confiabilidade,
        warningMessage: warningMessage || undefined,
        pendenciaHomologacao,
    };
};

export const calculateItcdForState = (uf: UF, baseValue: number, settings: any, deathDate?: string, taxType: ItcdTaxType = 'CAUSA_MORTIS'): ItcdResult => {
    const strategy = strategies[uf] || DefaultStrategy;
    return stampReliability(uf, taxType, strategy.calculate({ baseValue, settings, deathDate, taxType }));
};
