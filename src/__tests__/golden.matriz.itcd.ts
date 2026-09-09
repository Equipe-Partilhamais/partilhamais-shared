// MATRIZ DOURADA DO ITCD — a definição das combinações que ficam congeladas.
//
// Mora aqui (e não dentro do teste) porque o gerador em `scripts/gerar-golden-itcd.ts` e o
// teste `golden.itcd.test.ts` PRECISAM percorrer exatamente a mesma matriz: se cada um
// tivesse a sua, o teste passaria comparando coisas diferentes.
//
// A matriz é: 27 UFs × {CAUSA_MORTIS, DOACAO} × bases nos cortes de faixa (o corte, o corte
// −0,01 e o corte +0,01) e nas bases degeneradas × datas de fato gerador × flag de desconto.

import { UF } from '../types';
import { calculateItcdForState } from '../services/itcdStrategies';
import { classifyItcdWarning, ItcdTaxType } from '../services/itcdStrategies';
import { fiscalUnitsApi } from '../services/fiscalUnitsApi';
import { formatCurrency } from '../utils/formatters';
import { fechaCom, TOLERANCIA_INVARIANTE, ValorGolden, VetorGolden } from './golden.formato';

export const UFS: UF[] = [
    'AC', 'AL', 'AM', 'AP', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA',
    'MG', 'MS', 'MT', 'PA', 'PB', 'PE', 'PI', 'PR', 'RJ', 'RN',
    'RO', 'RR', 'RS', 'SC', 'SE', 'SP', 'TO',
];

export const TIPOS: ItcdTaxType[] = ['CAUSA_MORTIS', 'DOACAO'];

// `undefined` é o caminho MAIS USADO em produção (o inventário nem sempre tem data do óbito
// preenchida) e é justamente o que resolve a unidade fiscal pelo último ponto da série.
// As demais cobrem: antes do início da série, dentro da vigência, e ano posterior a ela.
export const DATAS_FATO_GERADOR: (string | undefined)[] = [
    undefined,
    '2024-06-10',
    '2025-03-20',
    '2026-02-01',
];

export const DESCONTOS: boolean[] = [false, true];

const centavos = (valor: number): number => Math.round(valor * 100) / 100;

// Data usada SÓ para converter em reais os cortes expressos em unidade fiscal. É fixa de
// propósito: se a série de índices ganhar um ponto novo, a matriz inteira não se desloca
// sozinha — mudam apenas os vetores das datas afetadas, que é o diff que se quer ler.
const DATA_REFERENCIA_DOS_CORTES = '2025-06-15';

// Cortes de faixa lidos das estratégias em `src/services/itcdStrategies/states/`. É um
// ESPELHO, não a fonte: mudou faixa lá, atualize aqui e regere — o diff dos vetores mostra
// quanto imposto a mudança moveu, caso a caso.
const CORTES_EM_REAIS: { [uf: string]: number[] } = {
    AL: [25000, 150000, 300000],
    AM: [100000, 400000],
    AP: [100000, 400000],
    BA: [100000, 200000, 300000],
    DF: [1000000, 2000000],
    PE: [80000, 350000, 550000, 750000],
    RO: [100000, 300000],
    SC: [20000, 50000, 150000],
    TO: [100000, 400000, 800000],
};

// Cortes que a estratégia enquadra na unidade fiscal da UF (UFIRCE, UPF, UFIR-RJ, UFEMG).
// Viram reais pelo valor do índice — por isso o corte em R$ muda quando o índice muda.
const CORTES_EM_UNIDADES: { [uf: string]: number[] } = {
    CE: [2500, 5000, 10000],
    MT: [1500, 4000, 8000, 16000],
    MG: [90000], // limite do desconto de 50% da doação (art. 23-A)
    RJ: [70000, 100000, 200000, 300000, 400000],
    RS: [2000, 10000, 30000, 50000], // união dos cortes de causa mortis e de doação
};

// Zero, o menor valor representável em centavos, o menor inteiro e um espólio grande: é onde
// divisão por base, `Math.max(0, ...)` e alíquota efetiva costumam se comportar diferente.
const BASES_DEGENERADAS = [0, 0.01, 1, 50000000];

// Bases redondas comuns na prática, para que toda UF — inclusive as de alíquota fixa, que não
// têm corte nenhum — tenha vetor em valores de caso real.
const BASES_COMUNS = [100000, 1000000, 10000000];

export const basesDaUf = (uf: UF): number[] => {
    const cortes = [...(CORTES_EM_REAIS[uf] || [])];

    (CORTES_EM_UNIDADES[uf] || []).forEach(emUnidades => {
        const unidade = fiscalUnitsApi.getUnit(uf, DATA_REFERENCIA_DOS_CORTES);
        if (!unidade) {
            throw new Error(
                `A matriz dourada espera série de unidade fiscal para ${uf} (cortes em unidade), ` +
                    'mas fiscalUnitsApi não tem nenhuma. Ajuste a matriz ou a série.'
            );
        }
        cortes.push(centavos(emUnidades * unidade.value));
    });

    const bases = new Set<number>([...BASES_DEGENERADAS, ...BASES_COMUNS]);
    // O corte exato e os dois vizinhos de 1 centavo: é a fronteira da faixa que precisa ficar
    // travada, porque é onde um `<=` virando `<` muda o imposto sem mudar mais nada.
    cortes.forEach(corte => {
        bases.add(centavos(corte - 0.01));
        bases.add(centavos(corte));
        bases.add(centavos(corte + 0.01));
    });

    return Array.from(bases)
        .filter(base => base >= 0)
        .sort((a, b) => a - b);
};

export interface CombinacaoItcd {
    uf: UF;
    tipo: ItcdTaxType;
    base: number;
    dataFatoGerador?: string;
    aplicaDesconto: boolean;
}

const SEM_DATA = 'SEM_DATA';

export const idDaCombinacao = (c: CombinacaoItcd): string =>
    [c.uf, c.tipo, c.base.toFixed(2), c.dataFatoGerador || SEM_DATA, c.aplicaDesconto ? 'DESC' : 'SEM_DESC'].join('|');

/** Rótulo humano da combinação. É o que aparece na mensagem de falha do teste. */
export const descreverCombinacaoItcd = (id: string): string => {
    const [uf, tipo, base, data, desconto] = id.split('|');
    const rotuloData = data === SEM_DATA ? 'sem data do fato gerador' : `fato gerador ${data}`;
    return `${uf} · ${tipo} · base ${formatCurrency(Number(base))} · ${rotuloData} · desconto ${
        desconto === 'DESC' ? 'ligado' : 'desligado'
    }`;
};

export const combinacoesItcd = (): CombinacaoItcd[] => {
    const combinacoes: CombinacaoItcd[] = [];
    UFS.forEach(uf => {
        basesDaUf(uf).forEach(base => {
            TIPOS.forEach(tipo => {
                DATAS_FATO_GERADOR.forEach(dataFatoGerador => {
                    DESCONTOS.forEach(aplicaDesconto => {
                        combinacoes.push({ uf, tipo, base, dataFatoGerador, aplicaDesconto });
                    });
                });
            });
        });
    });
    return combinacoes;
};

const ouNulo = <T>(valor: T | undefined): T | null => (valor === undefined ? null : valor);

export const vetorItcd = (c: CombinacaoItcd): VetorGolden => {
    const resultado = calculateItcdForState(
        c.uf,
        c.base,
        { applyInventoryDiscount: c.aplicaDesconto },
        c.dataFatoGerador,
        c.tipo
    );

    const unidade = resultado.fiscalUnitUsed;

    return {
        id: idDaCombinacao(c),
        uf: c.uf,
        tipo: c.tipo,
        base: c.base,
        dataFatoGerador: ouNulo(c.dataFatoGerador),
        aplicaDesconto: c.aplicaDesconto,

        imposto: resultado.taxAmount,
        aliquotaEfetiva: resultado.effectiveRate,
        confiabilidade: ouNulo(resultado.confiabilidade),

        impostoOriginal: ouNulo(resultado.originalTaxAmount),
        valorDesconto: ouNulo(resultado.discountValue),
        descontoAplicado: ouNulo(resultado.discountApplied),

        textoLegal: resultado.legalText,
        aviso: ouNulo(resultado.warningMessage),
        // Congelada junto porque a tela e o DOCX escolhem o rótulo da ressalva por ela: mudar
        // o texto de um aviso sem mudar o marcador reclassifica a ressalva em silêncio.
        categoriasAviso: classifyItcdWarning(resultado.warningMessage),
        pendenciaHomologacao: ouNulo(resultado.pendenciaHomologacao),

        unidadeFiscal: unidade
            ? {
                  name: unidade.name,
                  value: unidade.value,
                  vigenciaInicio: ouNulo(unidade.vigenciaInicio),
                  source: ouNulo(unidade.source),
                  outdated: ouNulo(unidade.outdated),
                  conferida: unidade.conferida,
              }
            : null,

        memoria: (resultado.calculationMemory || []).map(linha => ({
            rangeLabel: linha.rangeLabel,
            base: linha.base,
            rate: linha.rate,
            tax: linha.tax,
            isFiscalUnit: ouNulo(linha.isFiscalUnit),
            unitName: ouNulo(linha.unitName),
            unitValue: ouNulo(linha.unitValue),
            valueInUnits: ouNulo(linha.valueInUnits),
            unitVigencia: ouNulo(linha.unitVigencia),
            isConversionStep: ouNulo(linha.isConversionStep),
        })) as ValorGolden,
    };
};

export const gerarVetoresItcd = (): VetorGolden[] => combinacoesItcd().map(vetorItcd);

// ----------------------------------------------------------------- INVARIANTES
//
// O vetor dourado congela o comportamento ATUAL, certo ou errado. O invariante é o que
// distingue os dois: se a soma das partes não fecha com o total, o número congelado está
// errado e congelá-lo sem dizer nada transformaria um defeito em contrato.

export interface ViolacaoInvariante {
    id: string;
    invariante: string;
    detalhe: string;
}

const linhasDaMemoria = (vetor: VetorGolden) =>
    (vetor.memoria as unknown as {
        rangeLabel: string;
        base: number;
        rate: number;
        tax: number;
        isConversionStep: boolean | null;
    }[]) || [];

export const violacoesDeInvarianteItcd = (vetor: VetorGolden): ViolacaoInvariante[] => {
    const falhas: ViolacaoInvariante[] = [];
    const imposto = vetor.imposto as number;
    const base = vetor.base as number;
    const memoria = linhasDaMemoria(vetor);

    const registrar = (invariante: string, detalhe: string) =>
        falhas.push({ id: vetor.id, invariante, detalhe });

    if (!Number.isFinite(imposto)) {
        registrar('imposto finito', `imposto = ${imposto}`);
    } else if (imposto < -TOLERANCIA_INVARIANTE) {
        registrar('imposto não negativo', `imposto = ${formatCurrency(imposto)}`);
    }

    // O principal: a coluna "Imposto" da memória de cálculo é o que o cliente vê no DOCX.
    // Se ela não soma o imposto devido, o documento entregue contradiz o próprio total.
    if (memoria.length > 0) {
        const soma = memoria.reduce((total, linha) => total + linha.tax, 0);
        if (!fechaCom(soma, imposto)) {
            registrar(
                'soma da memória de cálculo = imposto',
                `soma das linhas ${formatCurrency(soma)} contra imposto ${formatCurrency(imposto)} ` +
                    `(diferença ${formatCurrency(soma - imposto)})`
            );
        }
    }

    memoria.forEach((linha, indice) => {
        if (linha.isConversionStep && linha.tax !== 0) {
            registrar(
                'linha de conversão não gera imposto',
                `memoria[${indice}] "${linha.rangeLabel}" tem tax ${formatCurrency(linha.tax)}`
            );
        }
    });

    const impostoOriginal = vetor.impostoOriginal as number | null;
    const valorDesconto = vetor.valorDesconto as number | null;
    if (impostoOriginal !== null && valorDesconto !== null) {
        if (!fechaCom(impostoOriginal - valorDesconto, imposto)) {
            registrar(
                'imposto = imposto original − desconto',
                `${formatCurrency(impostoOriginal)} − ${formatCurrency(valorDesconto)} = ` +
                    `${formatCurrency(impostoOriginal - valorDesconto)}, mas o imposto é ${formatCurrency(imposto)}`
            );
        }
    }

    // Alíquota efetiva que não reproduz o imposto sobre a base é alíquota que o cliente lê
    // no relatório e não bate com o valor cobrado.
    const aliquota = vetor.aliquotaEfetiva as number;
    if (!fechaCom(base * aliquota, imposto)) {
        registrar(
            'base × alíquota efetiva = imposto',
            `${formatCurrency(base)} × ${aliquota} = ${formatCurrency(base * aliquota)}, ` +
                `mas o imposto é ${formatCurrency(imposto)}`
        );
    }

    // Desconto anunciado sem valor abatido (ou o contrário) é o par de campos que a tela usa
    // para escrever "com benefício de X%": um sem o outro mostra abatimento que não existe.
    const descontoAplicado = vetor.descontoAplicado as string | null;
    const temRotulo = !!descontoAplicado;
    const temValor = (valorDesconto || 0) > TOLERANCIA_INVARIANTE;
    // Só faz sentido perguntar quando havia imposto a descontar: com base (ou faixa) zerada
    // o benefício existe e vale R$ 0,00, e isso não é incoerência.
    if ((impostoOriginal || 0) > TOLERANCIA_INVARIANTE && temRotulo !== temValor) {
        registrar(
            'rótulo de desconto acompanha valor descontado',
            `descontoAplicado ${JSON.stringify(descontoAplicado)} com valorDesconto ` +
                `${formatCurrency(valorDesconto || 0)}`
        );
    }

    return falhas;
};
