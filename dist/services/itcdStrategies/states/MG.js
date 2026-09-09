"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MGStrategy = void 0;
const fiscalUnitsApi_1 = require("../../fiscalUnitsApi");
const utils_1 = require("../utils");
const warnings_1 = require("../warnings");
const formatters_1 = require("../../../utils/formatters");
const PRAZO_DESCONTO_DIAS = 90;
const ALIQUOTA_DESCONTO = 0.15;
const MS_POR_DIA = 24 * 60 * 60 * 1000;
// Datas do caso são lidas em UTC puro e nunca comparadas com o relógio: o mesmo inventário
// tem de dar o mesmo imposto no navegador (BRT) e no servidor (UTC). Com `new Date(y, m-1, d)`
// mais `new Date()` o desconto de 15% mudava conforme o fuso e a hora da consulta.
const parseDataDoCaso = (isoDate) => {
    const partes = /^(\d{4})-(\d{2})-(\d{2})/.exec(isoDate);
    if (!partes)
        return null;
    const [, ano, mes, dia] = partes;
    const data = new Date(Date.UTC(Number(ano), Number(mes) - 1, Number(dia)));
    // O construtor normaliza data inexistente (31/02 vira 03/03) em silêncio.
    return data.getUTCMonth() === Number(mes) - 1 && data.getUTCDate() === Number(dia) ? data : null;
};
const somaDias = (data, dias) => new Date(data.getTime() + dias * MS_POR_DIA);
// Formatação própria em vez de toLocaleDateString('pt-BR'): o Node pode rodar sem o locale
// pt-BR e imprimir a data no formato americano no documento entregue ao cliente.
const formataDataBR = (data) => `${String(data.getUTCDate()).padStart(2, '0')}/${String(data.getUTCMonth() + 1).padStart(2, '0')}/${data.getUTCFullYear()}`;
exports.MGStrategy = {
    calculate({ baseValue, deathDate, settings, taxType }) {
        const safeBaseValue = baseValue || 0;
        // --- REGRA DE DOAÇÃO (MG) ---
        // Base: Lei 14.941/2003
        if (taxType === 'DOACAO') {
            const unit = fiscalUnitsApi_1.fiscalUnitsApi.requireUnit('MG', { id: 'UFEMG', name: 'UFEMG', value: 5.62 }, deathDate);
            const valueInUnit = safeBaseValue / unit.value;
            // 1. Alíquota Base: 5% (Conforme correção do usuário)
            const baseTax = safeBaseValue * 0.05;
            let taxAmount = baseTax;
            let discountValue = 0;
            let discountApplied = '';
            const memory = [];
            // 2. Desconto do Art. 23-A
            // "Na hipótese de doação cujo valor seja de até 90.000 UFEMGs, será concedido desconto de 50%..."
            if (valueInUnit <= 90000) {
                discountValue = baseTax * 0.50;
                taxAmount = baseTax - discountValue;
                discountApplied = 'Desconto de 50% (Art. 23-A da Lei 14.941/2003)';
            }
            // Memória de Conversão para evidenciar o limite de 90.000 UFEMGs.
            // A conversão não gera imposto: o valor em UFEMG vai em `valueInUnits`, não na
            // coluna "Imposto" — senão a soma da memória não fecha com o total devido.
            memory.push((0, utils_1.buildConversionStep)(`Valor em ${unit.name} (Limite p/ desconto: 90.000)`, safeBaseValue, valueInUnit, { name: unit.name, value: unit.value, vigenciaInicio: unit.vigenciaInicio }));
            memory.push({
                rangeLabel: 'Alíquota de doação (5%)',
                base: safeBaseValue,
                rate: 0.05,
                tax: baseTax,
                isFiscalUnit: false
            });
            if (discountApplied) {
                memory.push({
                    rangeLabel: 'Aplicação do Desconto (50%)',
                    base: baseTax,
                    rate: 0.50,
                    tax: discountValue * -1, // Mostra negativo
                    isFiscalUnit: false
                });
            }
            return {
                taxAmount: taxAmount,
                effectiveRate: safeBaseValue > 0 ? taxAmount / safeBaseValue : 0,
                legalText: `Lei 14.941/2003. Alíquota 5%. ${discountApplied ? 'Com benefício do Art. 23-A.' : ''}`,
                originalTaxAmount: baseTax,
                discountValue: discountValue,
                discountApplied: discountApplied,
                calculationMemory: memory,
                fiscalUnitUsed: {
                    name: unit.name,
                    value: unit.value,
                    vigenciaInicio: unit.vigenciaInicio,
                    source: unit.source,
                    outdated: unit.outdated,
                    conferida: unit.conferida,
                },
            };
        }
        // --- REGRA CAUSA MORTIS (MG): 5% Fixo ---
        const tax = safeBaseValue * 0.05;
        const originalTax = tax;
        // Sem data de recolhimento não há desconto aplicado: os dois campos ficam zerados de
        // propósito, para que a tela não exiba um abatimento que não entrou no imposto devido.
        const discountApplied = '';
        const discountValue = 0;
        let warningMessage = '';
        // Regra de Desconto de MG (Causa Mortis): 15% se pago em até 90 dias do óbito.
        // O desconto depende da data de RECOLHIMENTO, que o inventário não guarda. O motor
        // devolve então o imposto cheio e informa o benefício como projeção — aplicá-lo por
        // conta própria significaria supor um pagamento que ninguém declarou.
        if (settings?.applyInventoryDiscount) {
            const death = deathDate ? parseDataDoCaso(deathDate) : null;
            if (!death) {
                warningMessage = (0, warnings_1.avisoDescontoSemDataDoObito)();
            }
            else {
                const dataLimite = somaDias(death, PRAZO_DESCONTO_DIAS);
                const descontoPotencial = tax * ALIQUOTA_DESCONTO;
                // A frase abre com "Desconto não calculado" porque é o marcador que classifica
                // a ressalva como PRAZO em warnings.ts.
                warningMessage =
                    `Desconto não calculado: os ${ALIQUOTA_DESCONTO * 100}% por pagamento em até ` +
                        `${PRAZO_DESCONTO_DIAS} dias do óbito dependem da data de recolhimento, que não consta do caso. ` +
                        `Se o pagamento ocorrer até ${formataDataBR(dataLimite)}, o imposto cai de ` +
                        `${(0, formatters_1.formatCurrency)(tax)} para ${(0, formatters_1.formatCurrency)(tax - descontoPotencial)} ` +
                        `(economia de ${(0, formatters_1.formatCurrency)(descontoPotencial)}).`;
            }
        }
        return {
            taxAmount: tax,
            effectiveRate: safeBaseValue > 0 ? tax / safeBaseValue : 0,
            legalText: 'Lei Estadual 14.941/2003. Alíquota Fixa de 5% (Causa Mortis).',
            discountApplied,
            warningMessage,
            originalTaxAmount: originalTax,
            discountValue
        };
    }
};
