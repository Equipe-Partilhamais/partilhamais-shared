/**
 * Duas garantias que faltavam:
 *
 * 1. A ressalva do índice fiscal saía por `conferida === false`, com o campo OPCIONAL no tipo:
 *    a estratégia que esquecesse de propagá-lo perdia o aviso em silêncio (nem tsc nem suíte
 *    acusavam). Aqui todas as UFs que usam unidade fiscal são exercitadas, não só o RJ.
 * 2. Todos os avisos viajam no mesmo `warningMessage`, e o consumidor rotulava qualquer um
 *    deles como "tabela não conferida contra a lei estadual" — errado para aviso de prazo e
 *    de competência. `classifyItcdWarning` é o que permite a tela dizer o que de fato houve.
 */
import { describe, expect, it } from 'vitest';
import { calculateItcdForState } from '../services/itcdStrategies';
import {
    avisoAliquotaDoacaoNaoHomologada,
    avisoDescontoSemDataDoObito,
    avisoIndiceForaDaVigencia,
    avisoIndiceNaoConferido,
    avisoPrazoDescontoExpirado,
    avisoTabelaNaoHomologada,
    classifyItcdWarning,
    groupItcdWarningCategories,
} from '../services/itcdStrategies';
import { ItcdTaxType } from '../services/itcdStrategies/types';

const OBITO_NA_VIGENCIA = '2025-06-15';

// MG só usa a UFEMG na regra de doação; as demais usam a unidade fiscal na causa mortis.
const COM_UNIDADE_FISCAL: Array<[string, ItcdTaxType]> = [
    ['CE', 'CAUSA_MORTIS'],
    ['MT', 'CAUSA_MORTIS'],
    ['RJ', 'CAUSA_MORTIS'],
    ['RS', 'CAUSA_MORTIS'],
    ['MG', 'DOACAO'],
];

describe('ressalva do índice fiscal em todas as UFs que usam unidade fiscal', () => {
    it.each(COM_UNIDADE_FISCAL)('%s (%s) devolve a unidade não conferida e avisa', (uf, taxType) => {
        const resultado = calculateItcdForState(uf as never, 1_000_000, {}, OBITO_NA_VIGENCIA, taxType);

        expect(resultado.fiscalUnitUsed).toBeDefined();
        expect(resultado.fiscalUnitUsed!.conferida).toBe(false);
        expect(resultado.warningMessage).toContain('não foi conferido na SEFAZ');
        expect(classifyItcdWarning(resultado.warningMessage)).toContain('INDICE_FISCAL');
    });
});

describe('classificação das ressalvas do ITCD', () => {
    it('cada frase composta pelo motor é reconhecida na sua categoria', () => {
        expect(classifyItcdWarning(avisoTabelaNaoHomologada('SP'))).toEqual(['TABELA_NAO_HOMOLOGADA']);
        expect(classifyItcdWarning(avisoAliquotaDoacaoNaoHomologada('SP'))).toEqual(['TABELA_NAO_HOMOLOGADA']);
        expect(classifyItcdWarning(avisoIndiceNaoConferido('RJ', 'UFIR-RJ', 4.65, '2025-01-01'))).toEqual(['INDICE_FISCAL']);
        expect(classifyItcdWarning(avisoIndiceForaDaVigencia('UFIR-RJ', 4.65, '2025-01-01'))).toEqual(['INDICE_FISCAL']);
        expect(classifyItcdWarning(avisoPrazoDescontoExpirado(90, '01/09/2025'))).toEqual(['PRAZO']);
        expect(classifyItcdWarning(avisoDescontoSemDataDoObito())).toEqual(['PRAZO']);
    });

    it('aviso de competência não é confundido com tabela não conferida', () => {
        // Texto composto pelo calculationService (front e back) na resolução dos arts. 158/159.
        const competencia =
            'De cujus no exterior: informe a UF de domicílio do sucessor (aba Autor da Herança) para determinar a competência (arts. 158, III / 159, II, LC 227/2026).';

        expect(classifyItcdWarning(competencia)).toEqual(['COMPETENCIA']);
        expect(classifyItcdWarning('Doador e donatário no exterior: competência estimada pela UF do processo.')).toEqual(['COMPETENCIA']);
    });

    it('o aviso de índice fora da vigência não vira competência por citar a palavra', () => {
        // A frase termina em "Confirme o índice da competência." — sem marcador específico
        // ela cairia em COMPETENCIA e a tela pediria uma UF que já está definida.
        expect(classifyItcdWarning(avisoIndiceForaDaVigencia('UPF/RS', 27.24, '2025-01-01')))
            .not.toContain('COMPETENCIA');
    });

    it('MG com prazo de desconto vencido separa PRAZO de TABELA_NAO_HOMOLOGADA', () => {
        // Óbito antigo + desconto pedido → o motor concatena o aviso de prazo ao de tabela.
        const resultado = calculateItcdForState('MG', 1_000_000, { applyInventoryDiscount: true }, '2020-01-10', 'CAUSA_MORTIS');
        const categorias = classifyItcdWarning(resultado.warningMessage);

        expect(categorias).toContain('PRAZO');
        expect(categorias).toContain('TABELA_NAO_HOMOLOGADA');
    });

    it('texto desconhecido não é rotulado como tabela não conferida', () => {
        expect(classifyItcdWarning('Observação livre digitada por outro consumidor.')).toEqual(['OUTRO']);
        expect(classifyItcdWarning(undefined)).toEqual([]);
    });
});

describe('agrupamento das ressalvas por categoria', () => {
    it('separa a UF com prazo vencido da UF que só tem tabela não conferida', () => {
        const grupos = groupItcdWarningCategories([
            { state: 'SP', confiabilidade: 'NAO_CONFIGURADA', warningMessage: avisoTabelaNaoHomologada('SP') },
            {
                state: 'MG',
                confiabilidade: 'NAO_CONFIGURADA',
                warningMessage: `${avisoPrazoDescontoExpirado(90, '01/09/2025')} ${avisoTabelaNaoHomologada('MG')}`,
            },
        ]);

        expect(grupos.find(g => g.categoria === 'TABELA_NAO_HOMOLOGADA')!.ufs).toEqual(['MG', 'SP']);
        expect(grupos.find(g => g.categoria === 'PRAZO')!.ufs).toEqual(['MG']);
    });

    it('ausência do carimbo conta como não conferida — nunca como homologada', () => {
        const grupos = groupItcdWarningCategories([{ state: 'BA' }]);

        expect(grupos.map(g => g.categoria)).toEqual(['TABELA_NAO_HOMOLOGADA']);
    });

    it('UF homologada e sem aviso não gera ressalva nenhuma', () => {
        expect(groupItcdWarningCategories([{ state: 'BA', confiabilidade: 'HOMOLOGADA' }])).toEqual([]);
    });
});
