// MATRIZ DOURADA DO NÚCLEO SUCESSÓRIO — vocação hereditária, representação, meação,
// colaterais e redução por inoficiosidade congelados quinhão a quinhão.
//
// Por que quinhão e não só o peso devolvido pela função: peso de estirpe é número
// intermediário; o que chega ao cliente é "fulano recebe R$ X". Congelar o quinhão em reais
// é o que torna visível uma mudança de regra que redistribui o monte sem mudar a contagem
// de herdeiros.
//
// LIMITE DELIBERADO: `successionCore` é o núcleo COMUM aos dois apps e não contém a regra do
// art. 1.832 (quanto o cônjuge leva concorrendo com descendentes, com o piso de 1/4) nem a
// colação de adiantamentos — essas duas continuam escritas dentro de
// `calculationService.ts` de cada app. Aqui, portanto, congela-se a distribuição INTERNA da
// classe dos descendentes e o booleano `shouldSpouseCompeteWithDescendants`; o rateio entre
// cônjuge e descendentes não tem como ser congelado sem reimplementar no teste uma regra que
// o módulo não expõe — e um golden que testa código do próprio teste não protege nada.

import {
    allocateDebtByState,
    ascendantDegree,
    buildCollateralShares,
    buildDescendantSharesWithRepresentation,
    callAscendants,
    collateralDegree,
    getCommonEstateFactor,
    getPrivateEstateFactor,
    inheritsInOwnRight,
    inofficiousReductionFactors,
    isExcludedFromSuccession,
    isPreCompetenceChangeDeath,
    MAX_REPRESENTATION_DEPTH,
    shouldSpouseCompeteWithDescendants,
    siblingQuota,
    splitAmongAscendants,
    spouseShareWithAscendants,
    SuccessionHeir,
    SuccessionMaritalRegime,
} from '../services/successionCore';
import { formatCurrency } from '../utils/formatters';
import { fechaCom, TOLERANCIA_INVARIANTE, ValorGolden, VetorGolden } from './golden.formato';

/** Monte partilhável de referência. Divisível por 2, 3, 4, 5, 6 e 8 sem dízima. */
export const MONTE = 1200000;

const REGIMES: SuccessionMaritalRegime[] = [
    'COMUNHAO_UNIVERSAL',
    'COMUNHAO_PARCIAL',
    'SEPARACAO_TOTAL',
    'SEPARACAO_OBRIGATORIA',
    'SOLTEIRO',
    'UNIAO_ESTAVEL',
];

const herdeiro = (over: Partial<SuccessionHeir> & { id: string }): SuccessionHeir => ({
    name: over.id,
    type: 'DESCENDENTE',
    ...over,
});

type Quinhoes = { [id: string]: number };

const somar = (quinhoes: Quinhoes): number =>
    Object.keys(quinhoes).reduce((total, id) => total + quinhoes[id], 0);

/**
 * Quinhões dos descendentes: cada estirpe recebe uma fração igual do monte e os
 * representantes dividem a estirpe pelos pesos que o módulo devolveu (art. 1.855).
 */
const quinhoesDosDescendentes = (heirs: SuccessionHeir[], monte: number) => {
    const { stirpes } = buildDescendantSharesWithRepresentation(heirs);
    const quinhoes: Quinhoes = {};
    if (stirpes.length === 0) return { estirpes: [] as ValorGolden, quinhoes };

    const porEstirpe = monte / stirpes.length;
    stirpes.forEach(estirpe =>
        estirpe.members.forEach(membro => {
            quinhoes[membro.heir.id] = (quinhoes[membro.heir.id] || 0) + membro.weight * porEstirpe;
        })
    );

    const estirpes = stirpes.map(estirpe => ({
        childId: estirpe.childId,
        membros: estirpe.members.map(m => ({ id: m.heir.id, peso: m.weight })),
    })) as ValorGolden;

    return { estirpes, quinhoes };
};

/**
 * Quinhões da classe dos ascendentes, já com o cônjuge (arts. 1.836 e 1.837). A entrada é
 * filtrada por `inheritsInOwnRight` porque é isso que os dois apps fazem antes de chamar
 * `callAscendants` — o módulo não filtra sozinho (ver o vetor `contrato.callAscendants`).
 */
const quinhoesDosAscendentes = (heirs: SuccessionHeir[], monte: number, temConjuge: boolean) => {
    const ascendentes = heirs.filter(h => h.type === 'ASCENDENTE' && inheritsInOwnRight(h));
    const { degree, called } = callAscendants(ascendentes);
    const quinhoes: Quinhoes = {};

    // Classe vazia: a devolução do monte inteiro ao cônjuge (art. 1.838) não está neste
    // módulo, então não é congelada aqui — seria congelar regra escrita no próprio teste.
    if (called.length === 0) {
        return { grauChamado: degree, chamados: [] as ValorGolden, fracaoConjuge: 0, quinhoes };
    }

    const fracaoConjuge = temConjuge ? spouseShareWithAscendants(degree, called.length) : 0;
    if (fracaoConjuge > 0) quinhoes.conjuge = monte * fracaoConjuge;

    splitAmongAscendants(called, monte * (1 - fracaoConjuge)).forEach((valor, id) => {
        quinhoes[id] = valor;
    });

    return {
        grauChamado: degree,
        chamados: called.map(a => a.id) as ValorGolden,
        fracaoConjuge,
        quinhoes,
    };
};

/** Quinhões dos colaterais: os pesos do módulo (bilateral = 2, unilateral = 1) rateados. */
const quinhoesDosColaterais = (colaterais: SuccessionHeir[], monte: number) => {
    const partes = buildCollateralShares(colaterais);
    const totalPesos = partes.reduce((total, parte) => total + parte.weight, 0);
    const quinhoes: Quinhoes = {};

    if (totalPesos > 0) {
        partes.forEach(parte => {
            quinhoes[parte.heir.id] = (quinhoes[parte.heir.id] || 0) + (monte * parte.weight) / totalPesos;
        });
    }

    return {
        pesos: partes.map(p => ({ id: p.heir.id, peso: p.weight })) as ValorGolden,
        quinhoes,
    };
};

// ----------------------------------------------------------------- CENÁRIOS

interface CenarioSucessao {
    id: string;
    grupo: string;
    descricao: string;
    /** Conteúdo congelado. `quinhoes` (quando presente) passa pelos invariantes de fechamento. */
    saida: { [campo: string]: ValorGolden };
    quinhoes?: Quinhoes;
    /** Herdeiros do cenário, para o invariante "ninguém excluído recebe". */
    heirs?: SuccessionHeir[];
    monte?: number;
}

const cenariosDeRegime = (): CenarioSucessao[] => {
    const cenarios: CenarioSucessao[] = [];
    REGIMES.forEach(regime => {
        [true, false].forEach(temConjuge => {
            [true, false].forEach(temBensParticulares => {
                const fatorComum = getCommonEstateFactor(regime, temConjuge);
                const fatorParticular = getPrivateEstateFactor(regime, temConjuge);
                cenarios.push({
                    id: `regime|${regime}|conjuge=${temConjuge ? 'sim' : 'nao'}|particulares=${temBensParticulares ? 'sim' : 'nao'}`,
                    grupo: 'REGIME',
                    descricao: `${regime}, ${temConjuge ? 'com' : 'sem'} cônjuge, ${
                        temBensParticulares ? 'com' : 'sem'
                    } bens particulares`,
                    saida: {
                        fatorAcervoComum: fatorComum,
                        fatorAcervoParticular: fatorParticular,
                        meacaoSobreAcervoComum: MONTE * (1 - fatorComum),
                        espolioSobreAcervoComum: MONTE * fatorComum,
                        concorreComDescendentes: shouldSpouseCompeteWithDescendants(regime, temBensParticulares),
                    },
                });
            });
        });
    });
    return cenarios;
};

const cenariosDeDescendentes = (): CenarioSucessao[] => {
    const casos: { id: string; descricao: string; heirs: SuccessionHeir[] }[] = [
        {
            id: 'tres-filhos-vivos',
            descricao: 'três filhos vivos, por cabeça',
            heirs: [
                herdeiro({ id: 'f1', subtype: 'FILHO' }),
                herdeiro({ id: 'f2', subtype: 'FILHO' }),
                herdeiro({ id: 'f3', subtype: 'FILHO' }),
            ],
        },
        {
            id: 'filho-premorto-dois-netos',
            descricao: 'filho pré-morto representado por dois netos (art. 1.851)',
            heirs: [
                herdeiro({ id: 'f1', subtype: 'FILHO' }),
                herdeiro({ id: 'f2', subtype: 'FILHO', isPreDeceased: true }),
                herdeiro({ id: 'n1', subtype: 'NETO', parentId: 'f2' }),
                herdeiro({ id: 'n2', subtype: 'NETO', parentId: 'f2' }),
            ],
        },
        {
            id: 'representacao-ate-bisneto',
            descricao: 'representação em dois níveis, por estirpe (art. 1.855)',
            heirs: [
                herdeiro({ id: 'f1', subtype: 'FILHO' }),
                herdeiro({ id: 'f2', subtype: 'FILHO', isPreDeceased: true }),
                herdeiro({ id: 'n1', subtype: 'NETO', parentId: 'f2' }),
                herdeiro({ id: 'n2', subtype: 'NETO', parentId: 'f2', isPreDeceased: true }),
                herdeiro({ id: 'b1', subtype: 'NETO', parentId: 'n2' }),
                herdeiro({ id: 'b2', subtype: 'NETO', parentId: 'n2' }),
                herdeiro({ id: 'b3', subtype: 'NETO', parentId: 'n2' }),
            ],
        },
        {
            id: 'renunciante-nao-representado-indigno-sim',
            descricao: 'renunciante não é representado; indigno e deserdado são (arts. 1.811/1.816)',
            heirs: [
                herdeiro({ id: 'f1', subtype: 'FILHO', successionExclusion: 'RENUNCIA' }),
                herdeiro({ id: 'n1', subtype: 'NETO', parentId: 'f1' }),
                herdeiro({ id: 'f2', subtype: 'FILHO', successionExclusion: 'INDIGNIDADE' }),
                herdeiro({ id: 'n2', subtype: 'NETO', parentId: 'f2' }),
                herdeiro({ id: 'f3', subtype: 'FILHO', successionExclusion: 'DESERDACAO' }),
                herdeiro({ id: 'n3', subtype: 'NETO', parentId: 'f3' }),
                herdeiro({ id: 'f4', subtype: 'FILHO' }),
            ],
        },
        {
            id: 'classe-toda-renuncia',
            descricao: 'renunciando toda a classe, os netos herdam por cabeça (art. 1.811)',
            heirs: [
                herdeiro({ id: 'f1', subtype: 'FILHO', successionExclusion: 'RENUNCIA' }),
                herdeiro({ id: 'n1', subtype: 'NETO', parentId: 'f1' }),
                herdeiro({ id: 'n2', subtype: 'NETO', parentId: 'f1' }),
                herdeiro({ id: 'f2', subtype: 'FILHO', successionExclusion: 'RENUNCIA' }),
                herdeiro({ id: 'n3', subtype: 'NETO', parentId: 'f2' }),
            ],
        },
        {
            id: 'filho-premorto-sem-descendentes',
            descricao: 'filho pré-morto sem descendentes: a estirpe não se forma',
            heirs: [
                herdeiro({ id: 'f1', subtype: 'FILHO' }),
                herdeiro({ id: 'f2', subtype: 'FILHO', isPreDeceased: true }),
            ],
        },
        {
            id: 'filho-unilateral-mesma-quota',
            descricao: 'filho unilateral concorre em igualdade com o bilateral (art. 1.834)',
            heirs: [
                herdeiro({ id: 'f1', subtype: 'FILHO' }),
                herdeiro({ id: 'f2', subtype: 'FILHO_UNILATERAL' }),
            ],
        },
        {
            id: 'neto-orfao-sem-pai-cadastrado',
            descricao: 'neto cujo pai não está no rol não forma estirpe própria',
            heirs: [
                herdeiro({ id: 'f1', subtype: 'FILHO' }),
                herdeiro({ id: 'n1', subtype: 'NETO', parentId: 'inexistente' }),
            ],
        },
        {
            id: 'linha-reta-alem-do-teto-de-profundidade',
            descricao: `cadeia de pré-mortos mais funda que MAX_REPRESENTATION_DEPTH (${MAX_REPRESENTATION_DEPTH})`,
            heirs: (() => {
                const heirs: SuccessionHeir[] = [herdeiro({ id: 'g0', subtype: 'FILHO', isPreDeceased: true })];
                for (let i = 1; i <= MAX_REPRESENTATION_DEPTH + 2; i++) {
                    heirs.push(
                        herdeiro({
                            id: `g${i}`,
                            subtype: 'NETO',
                            parentId: `g${i - 1}`,
                            isPreDeceased: i < MAX_REPRESENTATION_DEPTH + 2,
                        })
                    );
                }
                return heirs;
            })(),
        },
    ];

    return casos.map(caso => {
        const { estirpes, quinhoes } = quinhoesDosDescendentes(caso.heirs, MONTE);
        return {
            id: `descendentes|${caso.id}`,
            grupo: 'DESCENDENTES',
            descricao: caso.descricao,
            saida: { estirpes, quinhoes: quinhoes as ValorGolden },
            quinhoes,
            heirs: caso.heirs,
            monte: MONTE,
        };
    });
};

const cenariosDeAscendentes = (): CenarioSucessao[] => {
    const casos: { id: string; descricao: string; heirs: SuccessionHeir[]; conjuge: boolean }[] = [
        {
            id: 'pai-e-mae-sem-conjuge',
            descricao: 'pai e mãe, sem cônjuge',
            conjuge: false,
            heirs: [
                herdeiro({ id: 'pai', type: 'ASCENDENTE', subtype: 'PAI' }),
                herdeiro({ id: 'mae', type: 'ASCENDENTE', subtype: 'PAI' }),
            ],
        },
        {
            id: 'pai-e-mae-com-conjuge',
            descricao: 'pai e mãe em concorrência com o cônjuge: 1/3 ao cônjuge (art. 1.837)',
            conjuge: true,
            heirs: [
                herdeiro({ id: 'pai', type: 'ASCENDENTE', subtype: 'PAI' }),
                herdeiro({ id: 'mae', type: 'ASCENDENTE', subtype: 'PAI' }),
            ],
        },
        {
            id: 'so-mae-com-conjuge',
            descricao: 'ascendente único de 1º grau: metade ao cônjuge (art. 1.837)',
            conjuge: true,
            heirs: [herdeiro({ id: 'mae', type: 'ASCENDENTE', subtype: 'PAI' })],
        },
        {
            id: 'mae-viva-exclui-avos',
            descricao: 'grau mais próximo exclui o mais remoto (art. 1.836, §1º)',
            conjuge: false,
            heirs: [
                herdeiro({ id: 'mae', type: 'ASCENDENTE', subtype: 'PAI' }),
                herdeiro({ id: 'avo1', type: 'ASCENDENTE', subtype: 'AVO' }),
                herdeiro({ id: 'avo2', type: 'ASCENDENTE', subtype: 'AVO' }),
            ],
        },
        {
            id: 'quatro-avos-com-conjuge',
            descricao: 'quatro avós com cônjuge: metade ao cônjuge mesmo em 2º grau (art. 1.837)',
            conjuge: true,
            heirs: [
                herdeiro({ id: 'avoP1', type: 'ASCENDENTE', subtype: 'AVO' }),
                herdeiro({ id: 'avoP2', type: 'ASCENDENTE', subtype: 'AVO' }),
                herdeiro({ id: 'avoM1', type: 'ASCENDENTE', subtype: 'AVO' }),
                herdeiro({ id: 'avoM2', type: 'ASCENDENTE', subtype: 'AVO' }),
            ],
        },
        {
            id: 'avos-por-linha-desequilibrada',
            descricao: 'duas linhas com número diferente de avós: metade para cada linha (art. 1.836, §2º)',
            conjuge: false,
            heirs: [
                herdeiro({ id: 'avoP1', type: 'ASCENDENTE', subtype: 'AVO', ascendantLine: 'PATERNA' }),
                herdeiro({ id: 'avoP2', type: 'ASCENDENTE', subtype: 'AVO', ascendantLine: 'PATERNA' }),
                herdeiro({ id: 'avoM1', type: 'ASCENDENTE', subtype: 'AVO', ascendantLine: 'MATERNA' }),
            ],
        },
        {
            id: 'avos-linha-parcialmente-informada',
            descricao: 'linha informada só em parte dos avós: volta ao rateio por cabeça',
            conjuge: false,
            heirs: [
                herdeiro({ id: 'avoP1', type: 'ASCENDENTE', subtype: 'AVO', ascendantLine: 'PATERNA' }),
                herdeiro({ id: 'avoM1', type: 'ASCENDENTE', subtype: 'AVO', ascendantLine: 'MATERNA' }),
                herdeiro({ id: 'avoX', type: 'ASCENDENTE', subtype: 'AVO' }),
            ],
        },
        {
            id: 'pai-premorto-mae-viva-com-conjuge',
            descricao: 'pai pré-morto fora da classe: sobra um ascendente, metade ao cônjuge',
            conjuge: true,
            heirs: [
                herdeiro({ id: 'pai', type: 'ASCENDENTE', subtype: 'PAI', isPreDeceased: true }),
                herdeiro({ id: 'mae', type: 'ASCENDENTE', subtype: 'PAI' }),
            ],
        },
        {
            id: 'pai-renunciante-avos-nao-sobem',
            descricao: 'renúncia do único ascendente de 1º grau não promove os avós na chamada do módulo',
            conjuge: false,
            heirs: [
                herdeiro({ id: 'pai', type: 'ASCENDENTE', subtype: 'PAI', successionExclusion: 'RENUNCIA' }),
                herdeiro({ id: 'avo1', type: 'ASCENDENTE', subtype: 'AVO' }),
            ],
        },
    ];

    return casos.map(caso => {
        const resultado = quinhoesDosAscendentes(caso.heirs, MONTE, caso.conjuge);
        return {
            id: `ascendentes|${caso.id}`,
            grupo: 'ASCENDENTES',
            descricao: caso.descricao,
            saida: {
                grauChamado: resultado.grauChamado,
                chamados: resultado.chamados,
                fracaoConjuge: resultado.fracaoConjuge,
                quinhoes: resultado.quinhoes as ValorGolden,
            },
            quinhoes: resultado.quinhoes,
            heirs: caso.heirs,
            monte: MONTE,
        };
    });
};

const cenariosDeColaterais = (): CenarioSucessao[] => {
    const casos: { id: string; descricao: string; heirs: SuccessionHeir[] }[] = [
        {
            id: 'dois-irmaos-bilaterais',
            descricao: 'dois irmãos bilaterais, por cabeça',
            heirs: [
                herdeiro({ id: 'i1', type: 'COLATERAL', subtype: 'IRMAO', siblingBond: 'BILATERAL' }),
                herdeiro({ id: 'i2', type: 'COLATERAL', subtype: 'IRMAO', siblingBond: 'BILATERAL' }),
            ],
        },
        {
            id: 'bilateral-e-unilateral',
            descricao: 'o bilateral herda o dobro do unilateral (arts. 1.841/1.843, §2º)',
            heirs: [
                herdeiro({ id: 'i1', type: 'COLATERAL', subtype: 'IRMAO', siblingBond: 'BILATERAL' }),
                herdeiro({ id: 'i2', type: 'COLATERAL', subtype: 'IRMAO', siblingBond: 'UNILATERAL' }),
            ],
        },
        {
            id: 'vinculo-nao-informado-presume-bilateral',
            descricao: 'sem vínculo informado presume-se bilateral',
            heirs: [
                herdeiro({ id: 'i1', type: 'COLATERAL', subtype: 'IRMAO' }),
                herdeiro({ id: 'i2', type: 'COLATERAL', subtype: 'IRMAO', siblingBond: 'UNILATERAL' }),
            ],
        },
        {
            id: 'irmao-premorto-representado-por-sobrinhos',
            descricao: 'sobrinhos representam o irmão pré-morto e dividem a quota dele (art. 1.853)',
            heirs: [
                herdeiro({ id: 'i1', type: 'COLATERAL', subtype: 'IRMAO' }),
                herdeiro({ id: 'i2', type: 'COLATERAL', subtype: 'IRMAO', isPreDeceased: true }),
                herdeiro({ id: 's1', type: 'COLATERAL', subtype: 'SOBRINHO', parentId: 'i2' }),
                herdeiro({ id: 's2', type: 'COLATERAL', subtype: 'SOBRINHO', parentId: 'i2' }),
            ],
        },
        {
            id: 'irmao-premorto-sem-sobrinhos',
            descricao: 'irmão pré-morto sem filhos: a quota dele não é distribuída como estirpe',
            heirs: [
                herdeiro({ id: 'i1', type: 'COLATERAL', subtype: 'IRMAO' }),
                herdeiro({ id: 'i2', type: 'COLATERAL', subtype: 'IRMAO', isPreDeceased: true }),
            ],
        },
        {
            id: 'sobrinho-de-irmao-vivo-nao-entra',
            descricao: 'o mais próximo exclui o mais remoto: sobrinho de irmão vivo fica de fora (art. 1.840)',
            heirs: [
                herdeiro({ id: 'i1', type: 'COLATERAL', subtype: 'IRMAO' }),
                herdeiro({ id: 's1', type: 'COLATERAL', subtype: 'SOBRINHO', parentId: 'i1' }),
            ],
        },
        {
            id: 'so-sobrinhos-por-cabeca',
            descricao: 'sem irmãos vivos, os sobrinhos herdam por cabeça; filho de unilateral leva metade',
            heirs: [
                herdeiro({ id: 'i1', type: 'COLATERAL', subtype: 'IRMAO', isPreDeceased: true, siblingBond: 'BILATERAL' }),
                herdeiro({ id: 'i2', type: 'COLATERAL', subtype: 'IRMAO', isPreDeceased: true, siblingBond: 'UNILATERAL' }),
                herdeiro({ id: 's1', type: 'COLATERAL', subtype: 'SOBRINHO', parentId: 'i1' }),
                herdeiro({ id: 's2', type: 'COLATERAL', subtype: 'SOBRINHO', parentId: 'i2' }),
            ],
        },
        {
            id: 'irmao-renunciante-com-filhos',
            descricao: 'irmão renunciante sai da classe e seus filhos concorrem por cabeça',
            heirs: [
                herdeiro({ id: 'i1', type: 'COLATERAL', subtype: 'IRMAO', successionExclusion: 'RENUNCIA' }),
                herdeiro({ id: 's1', type: 'COLATERAL', subtype: 'SOBRINHO', parentId: 'i1' }),
                herdeiro({ id: 'i2', type: 'COLATERAL', subtype: 'IRMAO', isPreDeceased: true }),
                herdeiro({ id: 's2', type: 'COLATERAL', subtype: 'SOBRINHO', parentId: 'i2' }),
            ],
        },
    ];

    return casos.map(caso => {
        const resultado = quinhoesDosColaterais(caso.heirs, MONTE);
        return {
            id: `colaterais|${caso.id}`,
            grupo: 'COLATERAIS',
            descricao: caso.descricao,
            saida: { pesos: resultado.pesos, quinhoes: resultado.quinhoes as ValorGolden },
            quinhoes: resultado.quinhoes,
            heirs: caso.heirs,
            monte: MONTE,
        };
    });
};

const cenariosDeTestamento = (): CenarioSucessao[] => {
    const casos: {
        id: string;
        descricao: string;
        disposicoes: { kind: 'QUOTA' | 'LEGADO'; value: number }[];
        limite: number;
    }[] = [
        {
            id: 'dentro-da-disponivel',
            descricao: 'disposições cabem na parte disponível: nada é reduzido',
            disposicoes: [
                { kind: 'QUOTA', value: 200000 },
                { kind: 'LEGADO', value: 100000 },
            ],
            limite: 600000,
        },
        {
            id: 'excesso-absorvido-pelas-quotas',
            descricao: 'reduz primeiro a quota testamentária, o legado fica inteiro (art. 1.967, §1º)',
            disposicoes: [
                { kind: 'QUOTA', value: 500000 },
                { kind: 'LEGADO', value: 300000 },
            ],
            limite: 600000,
        },
        {
            id: 'excesso-consome-quotas-e-atinge-legados',
            descricao: 'quota zerada e legado reduzido proporcionalmente',
            disposicoes: [
                { kind: 'QUOTA', value: 200000 },
                { kind: 'LEGADO', value: 700000 },
            ],
            limite: 600000,
        },
        {
            id: 'somente-legados-em-excesso',
            descricao: 'sem quota testamentária, todo o corte cai nos legados',
            disposicoes: [
                { kind: 'LEGADO', value: 400000 },
                { kind: 'LEGADO', value: 500000 },
            ],
            limite: 600000,
        },
        {
            id: 'excesso-exatamente-igual-as-quotas',
            descricao: 'excesso idêntico ao total das quotas: fronteira entre os dois ramos',
            disposicoes: [
                { kind: 'QUOTA', value: 300000 },
                { kind: 'LEGADO', value: 600000 },
            ],
            limite: 600000,
        },
        {
            id: 'sem-disposicoes',
            descricao: 'nenhuma disposição testamentária',
            disposicoes: [],
            limite: 600000,
        },
        {
            id: 'disponivel-zerada',
            descricao: 'parte disponível zerada: tudo é inoficioso',
            disposicoes: [
                { kind: 'QUOTA', value: 100000 },
                { kind: 'LEGADO', value: 100000 },
            ],
            limite: 0,
        },
    ];

    return casos.map(caso => {
        const fatores = inofficiousReductionFactors(caso.disposicoes, caso.limite);
        const quotas = caso.disposicoes.filter(d => d.kind === 'QUOTA').reduce((t, d) => t + d.value, 0);
        const legados = caso.disposicoes.filter(d => d.kind === 'LEGADO').reduce((t, d) => t + d.value, 0);
        return {
            id: `testamento|${caso.id}`,
            grupo: 'TESTAMENTO',
            descricao: caso.descricao,
            saida: {
                parteDisponivel: caso.limite,
                totalQuotas: quotas,
                totalLegados: legados,
                fatorQuota: fatores.quota,
                fatorLegado: fatores.legacy,
                quotasMantidas: quotas * fatores.quota,
                legadosMantidos: legados * fatores.legacy,
                totalMantido: quotas * fatores.quota + legados * fatores.legacy,
            },
        };
    });
};

const cenariosDePassivo = (): CenarioSucessao[] => {
    const casos: { id: string; descricao: string; acervo: [string, number][]; passivo: number }[] = [
        {
            id: 'passivo-menor-que-acervo',
            descricao: 'passivo rateado proporcionalmente entre duas UFs',
            acervo: [['SP', 800000], ['MG', 400000]],
            passivo: 300000,
        },
        {
            id: 'passivo-igual-ao-acervo',
            descricao: 'passivo consome exatamente o acervo',
            acervo: [['SP', 600000], ['RJ', 600000]],
            passivo: 1200000,
        },
        {
            id: 'passivo-maior-que-acervo',
            descricao: 'passivo maior que o acervo: cada UF é travada em zero',
            acervo: [['SP', 500000], ['RJ', 100000]],
            passivo: 900000,
        },
        {
            id: 'sem-passivo',
            descricao: 'sem passivo: o acervo passa intacto',
            acervo: [['SP', 500000], ['RJ', 100000]],
            passivo: 0,
        },
        {
            id: 'acervo-zerado',
            descricao: 'acervo zerado com passivo declarado',
            acervo: [['SP', 0], ['RJ', 0]],
            passivo: 100000,
        },
        {
            id: 'uf-com-acervo-zero-entre-outras',
            descricao: 'UF sem bens não absorve passivo',
            acervo: [['SP', 900000], ['BA', 0], ['MG', 300000]],
            passivo: 120000,
        },
    ];

    return casos.map(caso => {
        const entrada = new Map<string, number>(caso.acervo);
        const ajustado = allocateDebtByState(entrada, caso.passivo);
        const porUf: { [uf: string]: number } = {};
        ajustado.forEach((valor, uf) => {
            porUf[uf] = valor;
        });
        return {
            id: `passivo|${caso.id}`,
            grupo: 'PASSIVO',
            descricao: caso.descricao,
            saida: {
                acervoBruto: caso.acervo.reduce((t, [, v]) => t + v, 0),
                passivo: caso.passivo,
                porUf: porUf as ValorGolden,
                acervoLiquido: somar(porUf),
            },
        };
    });
};

/**
 * Contratos das funções primitivas — congelados sem composição, porque é assim que os apps
 * as consomem e é o que muda quando alguém "só ajusta um detalhe" dentro delas.
 */
const cenariosDeContrato = (): CenarioSucessao[] => {
    const paiPreMorto = herdeiro({ id: 'pai', type: 'ASCENDENTE', subtype: 'PAI', isPreDeceased: true });
    const maeViva = herdeiro({ id: 'mae', type: 'ASCENDENTE', subtype: 'PAI' });
    const chamada = callAscendants([paiPreMorto, maeViva]);

    const datas = ['2023-12-18', '2023-12-19', '2023-12-20', '2023-12-21', '2024-01-01'];

    return [
        {
            id: 'contrato|callAscendants-nao-filtra-premorto',
            grupo: 'CONTRATO',
            descricao: 'callAscendants não descarta pré-morto: filtrar é obrigação de quem chama',
            saida: {
                grau: chamada.degree,
                chamados: chamada.called.map(a => a.id) as ValorGolden,
                observacao:
                    'Os dois apps filtram com isPreDeceased/isExcludedFromSuccession ANTES de chamar. ' +
                    'Se um deles parar de filtrar, um ascendente morto passa a contar para o 1/3 do cônjuge.',
            },
        },
        {
            id: 'contrato|spouseShareWithAscendants',
            grupo: 'CONTRATO',
            descricao: 'fração do cônjuge por grau e quantidade de ascendentes (art. 1.837)',
            saida: {
                grau1_um: spouseShareWithAscendants(1, 1),
                grau1_dois: spouseShareWithAscendants(1, 2),
                grau1_tres: spouseShareWithAscendants(1, 3),
                grau2_um: spouseShareWithAscendants(2, 1),
                grau2_quatro: spouseShareWithAscendants(2, 4),
            },
        },
        {
            id: 'contrato|graus-e-quotas',
            grupo: 'CONTRATO',
            descricao: 'grau do ascendente/colateral e quota do irmão pelo subtipo',
            saida: {
                grauPai: ascendantDegree(herdeiro({ id: 'x', type: 'ASCENDENTE', subtype: 'PAI' })),
                grauAvo: ascendantDegree(herdeiro({ id: 'x', type: 'ASCENDENTE', subtype: 'AVO' })),
                grauSemSubtipo: ascendantDegree(herdeiro({ id: 'x', type: 'ASCENDENTE' })),
                grauIrmao: collateralDegree(herdeiro({ id: 'x', type: 'COLATERAL', subtype: 'IRMAO' })),
                grauSobrinho: collateralDegree(herdeiro({ id: 'x', type: 'COLATERAL', subtype: 'SOBRINHO' })),
                quotaBilateral: siblingQuota(herdeiro({ id: 'x', siblingBond: 'BILATERAL' })),
                quotaUnilateral: siblingQuota(herdeiro({ id: 'x', siblingBond: 'UNILATERAL' })),
                quotaSemVinculo: siblingQuota(herdeiro({ id: 'x' })),
                quotaIndefinida: siblingQuota(undefined),
            },
        },
        {
            id: 'contrato|marco-de-competencia-itcd',
            grupo: 'CONTRATO',
            descricao: 'marco da EC 132/2023 para a competência do ITCD sobre móveis',
            saida: {
                semData: isPreCompetenceChangeDeath(undefined),
                ...datas.reduce(
                    (acumulado, data) => ({ ...acumulado, [data]: isPreCompetenceChangeDeath(data) }),
                    {} as { [data: string]: ValorGolden }
                ),
            },
        },
    ];
};

export const cenariosSucessao = (): CenarioSucessao[] => [
    ...cenariosDeRegime(),
    ...cenariosDeDescendentes(),
    ...cenariosDeAscendentes(),
    ...cenariosDeColaterais(),
    ...cenariosDeTestamento(),
    ...cenariosDePassivo(),
    ...cenariosDeContrato(),
];

const DESCRICOES = new Map<string, string>();

export const gerarVetoresSucessao = (): VetorGolden[] =>
    cenariosSucessao().map(cenario => {
        DESCRICOES.set(cenario.id, cenario.descricao);
        return {
            id: cenario.id,
            grupo: cenario.grupo,
            descricao: cenario.descricao,
            monte: cenario.monte === undefined ? null : cenario.monte,
            ...cenario.saida,
        };
    });

export const descreverCenarioSucessao = (id: string): string => {
    if (DESCRICOES.size === 0) gerarVetoresSucessao();
    const descricao = DESCRICOES.get(id);
    return descricao ? `${id} — ${descricao}` : id;
};

// ----------------------------------------------------------------- INVARIANTES

export interface ViolacaoInvarianteSucessao {
    id: string;
    invariante: string;
    detalhe: string;
}

export const violacoesDeInvarianteSucessao = (): ViolacaoInvarianteSucessao[] => {
    const falhas: ViolacaoInvarianteSucessao[] = [];

    cenariosSucessao().forEach(cenario => {
        const registrar = (invariante: string, detalhe: string) =>
            falhas.push({ id: cenario.id, invariante, detalhe });

        if (cenario.quinhoes) {
            const ids = Object.keys(cenario.quinhoes);
            const total = somar(cenario.quinhoes);
            const monte = cenario.monte as number;

            // O invariante central: o que foi repartido tem de ser exatamente o monte. Um
            // quinhão que evapora (ou que é distribuído duas vezes) é dinheiro que a partilha
            // entregue ao cliente não fecha.
            if (ids.length > 0 && !fechaCom(total, monte)) {
                registrar(
                    'soma dos quinhões = monte',
                    `${formatCurrency(total)} repartidos contra monte de ${formatCurrency(monte)} ` +
                        `(diferença ${formatCurrency(total - monte)})`
                );
            }

            ids.forEach(id => {
                if (cenario.quinhoes[id] < -TOLERANCIA_INVARIANTE) {
                    registrar('quinhão não negativo', `${id} recebeu ${formatCurrency(cenario.quinhoes[id])}`);
                }
            });

            // Quem foi excluído da sucessão ou é pré-morto não pode aparecer com quinhão.
            (cenario.heirs || []).forEach(h => {
                const recebeu = cenario.quinhoes[h.id];
                if (recebeu === undefined) return;
                if (h.isPreDeceased) {
                    registrar('pré-morto não recebe quinhão', `${h.id} recebeu ${formatCurrency(recebeu)}`);
                }
                if (isExcludedFromSuccession(h)) {
                    registrar(
                        'excluído da sucessão não recebe quinhão',
                        `${h.id} (${h.successionExclusion}) recebeu ${formatCurrency(recebeu)}`
                    );
                }
            });
        }

        if (cenario.grupo === 'TESTAMENTO') {
            const mantido = cenario.saida.totalMantido as number;
            const limite = cenario.saida.parteDisponivel as number;
            const total = (cenario.saida.totalQuotas as number) + (cenario.saida.totalLegados as number);
            const esperado = Math.min(total, limite);
            if (!fechaCom(mantido, esperado)) {
                registrar(
                    'disposições mantidas = min(total disposto, parte disponível)',
                    `mantido ${formatCurrency(mantido)}, esperado ${formatCurrency(esperado)}`
                );
            }
        }

        if (cenario.grupo === 'PASSIVO') {
            const liquido = cenario.saida.acervoLiquido as number;
            const bruto = cenario.saida.acervoBruto as number;
            const passivo = cenario.saida.passivo as number;
            const esperado = bruto <= 0 ? bruto : Math.max(0, bruto - passivo);
            if (!fechaCom(liquido, esperado)) {
                registrar(
                    'acervo líquido = acervo bruto − passivo (nunca negativo)',
                    `líquido ${formatCurrency(liquido)}, esperado ${formatCurrency(esperado)}`
                );
            }
        }
    });

    return falhas;
};

// Estirpes: os pesos internos de cada estirpe têm de somar 1, senão a estirpe recebe fração
// diferente da que o rateio por estirpes lhe destinou.
export const violacoesDePesoDeEstirpe = (): ViolacaoInvarianteSucessao[] => {
    const falhas: ViolacaoInvarianteSucessao[] = [];
    cenariosDeDescendentes().forEach(cenario => {
        const estirpes = (cenario.saida.estirpes as unknown as {
            childId: string;
            membros: { id: string; peso: number }[];
        }[]) || [];
        estirpes.forEach(estirpe => {
            const soma = estirpe.membros.reduce((total, m) => total + m.peso, 0);
            if (Math.abs(soma - 1) > 1e-9) {
                falhas.push({
                    id: cenario.id,
                    invariante: 'pesos da estirpe somam 1',
                    detalhe: `estirpe de ${estirpe.childId} soma ${soma}`,
                });
            }
        });
    });
    return falhas;
};
