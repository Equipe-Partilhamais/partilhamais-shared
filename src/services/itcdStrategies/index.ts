
import { UF } from '../../types';
import { ItcdStrategy, ItcdTaxType, ItcdResult, ItcdReliability } from './types';
import { getHomologacao, getPendencia, isHomologada } from './homologacao';
import { getPerfilItcdUf, situacaoDaVigencia } from './perfilUf';
import {
    avisoAliquotaDoacaoNaoHomologada,
    avisoDoacaoMesmaTabelaPorLei,
    avisoIndiceForaDaVigencia,
    avisoIndiceNaoConferido,
    avisoTabelaForaDaVigencia,
    avisoTabelaPorSituacao,
    avisoVigenciaSemData,
    pendenciaPorSituacao,
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
export * from './perfilUf';

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
const stampReliability = (uf: string, taxType: ItcdTaxType, result: ItcdResult, deathDate?: string): ItcdResult => {
    const registro = getHomologacao(uf);
    const homologada = isHomologada(uf, taxType);
    const confiabilidade: ItcdReliability = homologada ? 'HOMOLOGADA' : 'NAO_CONFIGURADA';
    const perfil = getPerfilItcdUf(uf);

    let warningMessage = result.warningMessage;
    let pendenciaHomologacao: string | undefined;

    if (!homologada) {
        if (!registro) {
            pendenciaHomologacao = `UF "${uf}" sem estratégia própria; cálculo feito pela regra padrão nacional (4%).`;
        } else if (taxType === 'DOACAO' && isHomologada(uf, 'CAUSA_MORTIS')) {
            // Com a causa mortis conferida, o que falta é especificamente a tabela de doação.
            pendenciaHomologacao = getPendencia(uf, taxType);
        } else {
            // CALC-06: a pendência diz o que falta conforme a situação da tabela.
            pendenciaHomologacao = pendenciaPorSituacao(perfil);
        }

        // CALC-10: "valor calculado com a regra de causa mortis" só é verdade onde não há tabela
        // de doação. Nas UFs com tabela própria (AL, BA, MG, PB, RS) a frase era falsa; a ressalva
        // de tabela não conferida, logo abaixo, continua valendo para elas.
        if (taxType === 'DOACAO' && perfil.tabelaDoacao === 'NAO_REGISTRADA') {
            // O motor devolve o número da regra de causa mortis; sem este aviso o usuário
            // recebe um cálculo de doação com alíquota que ninguém conferiu.
            warningMessage = appendWarning(warningMessage, avisoAliquotaDoacaoNaoHomologada(uf));
        }
        if (taxType === 'DOACAO' && perfil.tabelaDoacao === 'MESMA_DA_CAUSA_MORTIS') {
            warningMessage = appendWarning(warningMessage, avisoDoacaoMesmaTabelaPorLei(uf));
        }

        // CALC-06: ressalva específica da situação da tabela, e não a mesma para as 27 UFs.
        warningMessage = appendWarning(warningMessage, avisoTabelaPorSituacao(uf, perfil));
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

    // Revisão: a vigência registrada da redação codificada é conferida contra a data do fato
    // gerador. Vale com ou sem homologação — tabela conferida fora da vigência continua errada.
    const vigencia = situacaoDaVigencia(uf, deathDate);
    if (vigencia === 'ANTERIOR') {
        warningMessage = appendWarning(warningMessage, avisoTabelaForaDaVigencia(uf, perfil.vigenciaDesde!, deathDate!, perfil.fonteVigencia));
    } else if (vigencia === 'SEM_DATA') {
        warningMessage = appendWarning(warningMessage, avisoVigenciaSemData(uf, perfil.vigenciaDesde!, perfil.fonteVigencia));
    }

    return {
        ...result,
        confiabilidade,
        warningMessage: warningMessage || undefined,
        pendenciaHomologacao,
        situacaoTabela: perfil.situacaoTabela,
        ...(vigencia === 'SEM_REGISTRO' ? {} : { vigencia, vigenciaDesde: perfil.vigenciaDesde }),
    };
};

export const calculateItcdForState = (uf: UF, baseValue: number, settings: any, deathDate?: string, taxType: ItcdTaxType = 'CAUSA_MORTIS'): ItcdResult => {
    const strategy = strategies[uf] || DefaultStrategy;
    return stampReliability(uf, taxType, strategy.calculate({ baseValue, settings, deathDate, taxType }), deathDate);
};
