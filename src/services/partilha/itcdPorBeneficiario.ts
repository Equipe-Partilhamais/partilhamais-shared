import { ItcdCalculationMemory, UF } from '../../types';
import { calculateItcdForState } from '../itcdStrategies';
import { ItcdFiscalUnitUsed, ItcdReliability, ItcdResult, ItcdTaxType } from '../itcdStrategies/types';
import { avisoItcdSemBeneficiarios, classifyItcdWarning } from '../itcdStrategies/warnings';
import { BaseDeCalculoItcd, PerfilItcdUf } from '../itcdStrategies/perfilUf';
import { SuccessionHeirType } from '../successionCore';
import { distributeCents, fromCents, toCents } from '../../utils/money';

// ITCD POR QUINHÃO (CALC-01).
//
// O motor chamava a estratégia UMA vez por UF, com o monte inteiro. Nas UFs progressivas isso
// enquadrava cada herdeiro na faixa do monte e anulava as isenções por quinhão: RS, 3 filhos e
// R$ 150.000 davam R$ 4.500 onde a lei dá zero. CTN, art. 35, parágrafo único: nas transmissões
// causa mortis há tantos fatos geradores quantos sejam os herdeiros ou legatários. Aqui a base
// de cada UF é rateada pelo quinhão de cada beneficiário (sem a meação, que não é transmissão)
// e a estratégia é chamada uma vez por beneficiário.

export interface PesoBeneficiario {
    personId: string;
    personName: string;
    personType: SuccessionHeirType;
    /** Parte deste beneficiário na base da UF (qualquer escala; o rateio normaliza). */
    peso: number;
}

export interface ItcdBeneficiarioUf {
    personId: string;
    personName: string;
    personType: SuccessionHeirType;
    /** Base deste beneficiário na UF, em reais com centavos exatos. */
    base: number;
    /** Imposto da guia deste beneficiário, arredondado a centavo (CALC-08). */
    taxAmount: number;
    effectiveRate: number;
    originalTaxAmount: number;
    discountValue: number;
    discountApplied?: string;
    warningMessage?: string;
    calculationMemory: ItcdCalculationMemory[];
}

export interface ItcdUfCalculado {
    state: UF;
    taxBase: number;
    taxAmount: number;
    effectiveRate: number;
    legalText: string;
    discountApplied?: string;
    originalTaxAmount: number;
    discountValue: number;
    warningMessage?: string;
    confiabilidade?: ItcdReliability;
    pendenciaHomologacao?: string;
    calculationMemory: ItcdCalculationMemory[];
    fiscalUnitUsed?: ItcdFiscalUnitUsed;
    baseDeCalculo: BaseDeCalculoItcd;
    fundamentoBaseDeCalculo: string;
    beneficiarios: ItcdBeneficiarioUf[];
    /** Havia base na UF e nenhum beneficiário para ratear: imposto 0 com aviso. */
    semBeneficiarios: boolean;
    /** Revisão (c): vigência registrada da tabela frente à data do fato gerador. */
    vigencia?: 'VIGENTE' | 'ANTERIOR' | 'SEM_DATA';
    vigenciaDesde?: string;
}

/**
 * Memória arredondada a centavo cuja coluna "Imposto" fecha EXATAMENTE com o total: cada linha
 * vai ao centavo mais próximo e o resíduo (no máximo alguns centavos) fica na linha de maior
 * imposto, para que o DOCX nunca mostre uma soma diferente do valor da guia.
 */
const arredondarMemoria = (linhas: ItcdCalculationMemory[], totalCentavos: number): ItcdCalculationMemory[] => {
    const arredondadas = linhas.map(l => ({ ...l, base: fromCents(toCents(l.base)), tax: fromCents(toCents(l.tax)) }));
    const soma = arredondadas.reduce((s, l) => s + toCents(l.tax), 0);
    const residuo = totalCentavos - soma;
    if (residuo !== 0 && arredondadas.length > 0) {
        let indice = 0;
        arredondadas.forEach((l, i) => {
            if (Math.abs(l.tax) > Math.abs(arredondadas[indice].tax)) indice = i;
        });
        arredondadas[indice] = { ...arredondadas[indice], tax: fromCents(toCents(arredondadas[indice].tax) + residuo) };
    }
    return arredondadas;
};

/**
 * Resultado de uma estratégia arredondado a centavo (CALC-08), preservando as identidades que
 * o golden do ITCD confere: original − desconto = imposto, e soma da memória = imposto.
 * Exportado para os apps que chamam `calculateItcdForState` fora da partilha.
 */
export const arredondarResultadoItcd = (r: ItcdResult): ItcdResult => {
    const imposto = toCents(r.taxAmount);
    const original = r.originalTaxAmount !== undefined ? toCents(r.originalTaxAmount) : imposto;
    return {
        ...r,
        taxAmount: fromCents(imposto),
        originalTaxAmount: fromCents(original),
        discountValue: fromCents(Math.max(0, original - imposto)),
        calculationMemory: r.calculationMemory ? arredondarMemoria(r.calculationMemory, imposto) : r.calculationMemory,
    };
};

const unicos = (valores: Array<string | undefined>): string[] =>
    Array.from(new Set(valores.filter((v): v is string => !!v && v.trim().length > 0)));

/**
 * Ressalva da UF a partir das ressalvas de cada guia. Iguais em todas: vai uma vez — e, se
 * trouxer valor de guia (projeção de desconto, categoria PRAZO), avisa que o número é por
 * beneficiário, para não ser lido como o da UF. Diferentes: cada uma com o nome de quem é.
 */
const comporAvisoDaUf = (beneficiarios: ItcdBeneficiarioUf[]): string | undefined => {
    const mensagens = beneficiarios.map(b => b.warningMessage || '');
    const distintas = unicos(mensagens);
    if (distintas.length === 0) return undefined;
    if (distintas.length === 1 && mensagens.every(m => m === distintas[0])) {
        const unica = distintas[0];
        return beneficiarios.length > 1 && classifyItcdWarning(unica).includes('PRAZO')
            ? `Por beneficiário (valores de cada guia): ${unica}`
            : unica;
    }
    return beneficiarios
        .filter(b => b.warningMessage)
        .map(b => `${b.personName}: ${b.warningMessage}`)
        .join(' ');
};

export interface ParametrosItcdDaUf {
    state: UF;
    /** Base total da UF (herança transmitida ali), em centavos. */
    baseCentavos: number;
    pesos: PesoBeneficiario[];
    perfil: PerfilItcdUf;
    settings: { applyInventoryDiscount: boolean };
    deathDate?: string;
    taxType: ItcdTaxType;
}

export const calcularItcdDaUf = (p: ParametrosItcdDaUf): ItcdUfCalculado => {
    const { state, baseCentavos, perfil, settings, deathDate, taxType } = p;
    const pesosValidos = p.pesos.filter(b => Number.isFinite(b.peso) && b.peso > 0);
    const basesCentavos = distributeCents(baseCentavos, pesosValidos.map(b => b.peso));

    const comBase = pesosValidos
        .map((b, i) => ({ ...b, baseCentavos: basesCentavos[i] }))
        .filter(b => b.baseCentavos > 0);

    const comum = {
        state,
        taxBase: fromCents(baseCentavos),
        baseDeCalculo: perfil.baseDeCalculo,
        fundamentoBaseDeCalculo: perfil.fonteBaseDeCalculo,
    };

    if (comBase.length === 0) {
        // Sem quinhão não há fato gerador apurável. Zero visível com aviso, e não o imposto do
        // monte com cara de devido: é o caso típico de bens cadastrados antes dos herdeiros.
        const meta = calculateItcdForState(state, 0, { applyInventoryDiscount: false }, deathDate, taxType);
        return {
            ...comum,
            taxAmount: 0,
            effectiveRate: 0,
            legalText: meta.legalText,
            originalTaxAmount: 0,
            discountValue: 0,
            warningMessage: [avisoItcdSemBeneficiarios(state, fromCents(baseCentavos)), meta.warningMessage].filter(Boolean).join(' '),
            confiabilidade: meta.confiabilidade,
            pendenciaHomologacao: meta.pendenciaHomologacao,
            calculationMemory: [],
            fiscalUnitUsed: meta.fiscalUnitUsed,
            beneficiarios: [],
            semBeneficiarios: baseCentavos > 0,
            vigencia: meta.vigencia,
            vigenciaDesde: meta.vigenciaDesde,
        };
    }

    let beneficiarios: ItcdBeneficiarioUf[];
    let referencia: ItcdResult;
    let memoriaDaUf: ItcdCalculationMemory[];
    let textosLegais: string[];

    if (perfil.baseDeCalculo === 'MONTE') {
        // Uma apuração sobre o monte, repartida pelo quinhão (pelo maior resto, ao centavo).
        referencia = arredondarResultadoItcd(calculateItcdForState(state, fromCents(baseCentavos), settings, deathDate, taxType));
        const pesosBase = comBase.map(b => b.baseCentavos);
        const impostos = distributeCents(toCents(referencia.taxAmount), pesosBase);
        const originais = distributeCents(toCents(referencia.originalTaxAmount ?? referencia.taxAmount), pesosBase);
        beneficiarios = comBase.map((b, i) => ({
            personId: b.personId,
            personName: b.personName,
            personType: b.personType,
            base: fromCents(b.baseCentavos),
            taxAmount: fromCents(impostos[i]),
            effectiveRate: b.baseCentavos > 0 ? impostos[i] / b.baseCentavos : 0,
            originalTaxAmount: fromCents(originais[i]),
            discountValue: fromCents(Math.max(0, originais[i] - impostos[i])),
            discountApplied: referencia.discountApplied || undefined,
            warningMessage: referencia.warningMessage,
            calculationMemory: [],
        }));
        memoriaDaUf = referencia.calculationMemory || [];
        textosLegais = [referencia.legalText];
    } else {
        const resultados = comBase.map(b => ({
            b,
            r: arredondarResultadoItcd(calculateItcdForState(state, fromCents(b.baseCentavos), settings, deathDate, taxType)),
        }));
        referencia = resultados[0].r;
        textosLegais = resultados.map(x => x.r.legalText);
        beneficiarios = resultados.map(({ b, r }) => ({
            personId: b.personId,
            personName: b.personName,
            personType: b.personType,
            base: fromCents(b.baseCentavos),
            taxAmount: r.taxAmount,
            effectiveRate: b.baseCentavos > 0 ? toCents(r.taxAmount) / b.baseCentavos : 0,
            originalTaxAmount: r.originalTaxAmount ?? r.taxAmount,
            discountValue: r.discountValue ?? 0,
            discountApplied: r.discountApplied || undefined,
            warningMessage: r.warningMessage,
            calculationMemory: r.calculationMemory || [],
        }));
        memoriaDaUf = beneficiarios.flatMap(b => b.calculationMemory.map(l => ({ ...l, rangeLabel: `${b.personName}: ${l.rangeLabel}` })));
    }

    const impostoCentavos = beneficiarios.reduce((s, b) => s + toCents(b.taxAmount), 0);
    const originalCentavos = beneficiarios.reduce((s, b) => s + toCents(b.originalTaxAmount), 0);

    return {
        ...comum,
        taxAmount: fromCents(impostoCentavos),
        effectiveRate: baseCentavos > 0 ? impostoCentavos / baseCentavos : 0,
        legalText: unicos(textosLegais).join(' | ') || referencia.legalText,
        discountApplied: unicos(beneficiarios.map(b => b.discountApplied)).join(' | ') || undefined,
        originalTaxAmount: fromCents(originalCentavos),
        discountValue: fromCents(Math.max(0, originalCentavos - impostoCentavos)),
        warningMessage: comporAvisoDaUf(beneficiarios),
        confiabilidade: referencia.confiabilidade,
        pendenciaHomologacao: referencia.pendenciaHomologacao,
        calculationMemory: memoriaDaUf,
        fiscalUnitUsed: referencia.fiscalUnitUsed,
        beneficiarios,
        semBeneficiarios: false,
        vigencia: referencia.vigencia,
        vigenciaDesde: referencia.vigenciaDesde,
    };
};
