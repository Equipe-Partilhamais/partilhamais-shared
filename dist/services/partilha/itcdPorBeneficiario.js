"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.calcularItcdDaUf = exports.arredondarResultadoItcd = void 0;
const itcdStrategies_1 = require("../itcdStrategies");
const warnings_1 = require("../itcdStrategies/warnings");
const money_1 = require("../../utils/money");
/**
 * Memória arredondada a centavo cuja coluna "Imposto" fecha EXATAMENTE com o total: cada linha
 * vai ao centavo mais próximo e o resíduo (no máximo alguns centavos) fica na linha de maior
 * imposto, para que o DOCX nunca mostre uma soma diferente do valor da guia.
 */
const arredondarMemoria = (linhas, totalCentavos) => {
    const arredondadas = linhas.map(l => ({ ...l, base: (0, money_1.fromCents)((0, money_1.toCents)(l.base)), tax: (0, money_1.fromCents)((0, money_1.toCents)(l.tax)) }));
    const soma = arredondadas.reduce((s, l) => s + (0, money_1.toCents)(l.tax), 0);
    const residuo = totalCentavos - soma;
    if (residuo !== 0 && arredondadas.length > 0) {
        let indice = 0;
        arredondadas.forEach((l, i) => {
            if (Math.abs(l.tax) > Math.abs(arredondadas[indice].tax))
                indice = i;
        });
        arredondadas[indice] = { ...arredondadas[indice], tax: (0, money_1.fromCents)((0, money_1.toCents)(arredondadas[indice].tax) + residuo) };
    }
    return arredondadas;
};
/**
 * Resultado de uma estratégia arredondado a centavo (CALC-08), preservando as identidades que
 * o golden do ITCD confere: original − desconto = imposto, e soma da memória = imposto.
 * Exportado para os apps que chamam `calculateItcdForState` fora da partilha.
 */
const arredondarResultadoItcd = (r) => {
    const imposto = (0, money_1.toCents)(r.taxAmount);
    const original = r.originalTaxAmount !== undefined ? (0, money_1.toCents)(r.originalTaxAmount) : imposto;
    return {
        ...r,
        taxAmount: (0, money_1.fromCents)(imposto),
        originalTaxAmount: (0, money_1.fromCents)(original),
        discountValue: (0, money_1.fromCents)(Math.max(0, original - imposto)),
        calculationMemory: r.calculationMemory ? arredondarMemoria(r.calculationMemory, imposto) : r.calculationMemory,
    };
};
exports.arredondarResultadoItcd = arredondarResultadoItcd;
const unicos = (valores) => Array.from(new Set(valores.filter((v) => !!v && v.trim().length > 0)));
/**
 * Ressalva da UF a partir das ressalvas de cada guia. Iguais em todas: vai uma vez — e, se
 * trouxer valor de guia (projeção de desconto, categoria PRAZO), avisa que o número é por
 * beneficiário, para não ser lido como o da UF. Diferentes: cada uma com o nome de quem é.
 */
const comporAvisoDaUf = (beneficiarios) => {
    const mensagens = beneficiarios.map(b => b.warningMessage || '');
    const distintas = unicos(mensagens);
    if (distintas.length === 0)
        return undefined;
    if (distintas.length === 1 && mensagens.every(m => m === distintas[0])) {
        const unica = distintas[0];
        return beneficiarios.length > 1 && (0, warnings_1.classifyItcdWarning)(unica).includes('PRAZO')
            ? `Por beneficiário (valores de cada guia): ${unica}`
            : unica;
    }
    return beneficiarios
        .filter(b => b.warningMessage)
        .map(b => `${b.personName}: ${b.warningMessage}`)
        .join(' ');
};
const calcularItcdDaUf = (p) => {
    const { state, baseCentavos, perfil, settings, deathDate, taxType } = p;
    const pesosValidos = p.pesos.filter(b => Number.isFinite(b.peso) && b.peso > 0);
    const basesCentavos = (0, money_1.distributeCents)(baseCentavos, pesosValidos.map(b => b.peso));
    const comBase = pesosValidos
        .map((b, i) => ({ ...b, baseCentavos: basesCentavos[i] }))
        .filter(b => b.baseCentavos > 0);
    const comum = {
        state,
        taxBase: (0, money_1.fromCents)(baseCentavos),
        baseDeCalculo: perfil.baseDeCalculo,
        fundamentoBaseDeCalculo: perfil.fonteBaseDeCalculo,
    };
    if (comBase.length === 0) {
        // Sem quinhão não há fato gerador apurável. Zero visível com aviso, e não o imposto do
        // monte com cara de devido: é o caso típico de bens cadastrados antes dos herdeiros.
        const meta = (0, itcdStrategies_1.calculateItcdForState)(state, 0, { applyInventoryDiscount: false }, deathDate, taxType);
        return {
            ...comum,
            taxAmount: 0,
            effectiveRate: 0,
            legalText: meta.legalText,
            originalTaxAmount: 0,
            discountValue: 0,
            warningMessage: [(0, warnings_1.avisoItcdSemBeneficiarios)(state, (0, money_1.fromCents)(baseCentavos)), meta.warningMessage].filter(Boolean).join(' '),
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
    let beneficiarios;
    let referencia;
    let memoriaDaUf;
    let textosLegais;
    if (perfil.baseDeCalculo === 'MONTE') {
        // Uma apuração sobre o monte, repartida pelo quinhão (pelo maior resto, ao centavo).
        referencia = (0, exports.arredondarResultadoItcd)((0, itcdStrategies_1.calculateItcdForState)(state, (0, money_1.fromCents)(baseCentavos), settings, deathDate, taxType));
        const pesosBase = comBase.map(b => b.baseCentavos);
        const impostos = (0, money_1.distributeCents)((0, money_1.toCents)(referencia.taxAmount), pesosBase);
        const originais = (0, money_1.distributeCents)((0, money_1.toCents)(referencia.originalTaxAmount ?? referencia.taxAmount), pesosBase);
        beneficiarios = comBase.map((b, i) => ({
            personId: b.personId,
            personName: b.personName,
            personType: b.personType,
            base: (0, money_1.fromCents)(b.baseCentavos),
            taxAmount: (0, money_1.fromCents)(impostos[i]),
            effectiveRate: b.baseCentavos > 0 ? impostos[i] / b.baseCentavos : 0,
            originalTaxAmount: (0, money_1.fromCents)(originais[i]),
            discountValue: (0, money_1.fromCents)(Math.max(0, originais[i] - impostos[i])),
            discountApplied: referencia.discountApplied || undefined,
            warningMessage: referencia.warningMessage,
            calculationMemory: [],
        }));
        memoriaDaUf = referencia.calculationMemory || [];
        textosLegais = [referencia.legalText];
    }
    else {
        const resultados = comBase.map(b => ({
            b,
            r: (0, exports.arredondarResultadoItcd)((0, itcdStrategies_1.calculateItcdForState)(state, (0, money_1.fromCents)(b.baseCentavos), settings, deathDate, taxType)),
        }));
        referencia = resultados[0].r;
        textosLegais = resultados.map(x => x.r.legalText);
        beneficiarios = resultados.map(({ b, r }) => ({
            personId: b.personId,
            personName: b.personName,
            personType: b.personType,
            base: (0, money_1.fromCents)(b.baseCentavos),
            taxAmount: r.taxAmount,
            effectiveRate: b.baseCentavos > 0 ? (0, money_1.toCents)(r.taxAmount) / b.baseCentavos : 0,
            originalTaxAmount: r.originalTaxAmount ?? r.taxAmount,
            discountValue: r.discountValue ?? 0,
            discountApplied: r.discountApplied || undefined,
            warningMessage: r.warningMessage,
            calculationMemory: r.calculationMemory || [],
        }));
        memoriaDaUf = beneficiarios.flatMap(b => b.calculationMemory.map(l => ({ ...l, rangeLabel: `${b.personName}: ${l.rangeLabel}` })));
    }
    const impostoCentavos = beneficiarios.reduce((s, b) => s + (0, money_1.toCents)(b.taxAmount), 0);
    const originalCentavos = beneficiarios.reduce((s, b) => s + (0, money_1.toCents)(b.originalTaxAmount), 0);
    return {
        ...comum,
        taxAmount: (0, money_1.fromCents)(impostoCentavos),
        effectiveRate: baseCentavos > 0 ? impostoCentavos / baseCentavos : 0,
        legalText: unicos(textosLegais).join(' | ') || referencia.legalText,
        discountApplied: unicos(beneficiarios.map(b => b.discountApplied)).join(' | ') || undefined,
        originalTaxAmount: (0, money_1.fromCents)(originalCentavos),
        discountValue: (0, money_1.fromCents)(Math.max(0, originalCentavos - impostoCentavos)),
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
exports.calcularItcdDaUf = calcularItcdDaUf;
