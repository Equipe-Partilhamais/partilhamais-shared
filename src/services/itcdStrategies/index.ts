
import { UF } from '../../types';
import { ItcdStrategy, ItcdTaxType, ItcdResult, ItcdReliability, ItcdUfNaoConfiguradaError } from './types';
import { getHomologacao, isHomologada } from './homologacao';
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
            pendenciaHomologacao = registro.pendencia;
        }

        if (taxType === 'DOACAO') {
            // O motor devolve o número da regra de causa mortis; sem este aviso o usuário
            // recebe um cálculo de doação com alíquota que ninguém conferiu.
            warningMessage = appendWarning(
                warningMessage,
                `Alíquota de doação não homologada para ${uf}: valor calculado com a regra de causa mortis.`
            );
        }

        warningMessage = appendWarning(
            warningMessage,
            `Valor referencial: a tabela de ITCD de ${uf} não está homologada no PartilhaMais. Confirme a alíquota vigente na SEFAZ/${uf} antes de usar.`
        );
    }

    // A unidade fiscal tem de ser a vigente na data do fato gerador; quando a série não cobre
    // essa data o número sai do último ponto conhecido e isso precisa aparecer.
    const unidade = result.fiscalUnitUsed;
    if (unidade?.outdated) {
        warningMessage = appendWarning(
            warningMessage,
            `Valor de ${unidade.name} usado (R$ ${unidade.value.toFixed(2)}${unidade.vigenciaInicio ? `, vigência ${unidade.vigenciaInicio}` : ''}) não cobre a data do fato gerador. Confirme o índice da competência.`
        );
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

/**
 * Mesma conta, mas recusa devolver número para UF/tipo sem tabela homologada.
 * Use nos fluxos que produzem documento oficial (guia, escritura, petição).
 */
export const calculateItcdForStateStrict = (uf: UF, baseValue: number, settings: any, deathDate?: string, taxType: ItcdTaxType = 'CAUSA_MORTIS'): ItcdResult => {
    const result = calculateItcdForState(uf, baseValue, settings, deathDate, taxType);
    if (result.confiabilidade !== 'HOMOLOGADA') {
        throw new ItcdUfNaoConfiguradaError(uf, taxType, result.pendenciaHomologacao);
    }
    return result;
};
