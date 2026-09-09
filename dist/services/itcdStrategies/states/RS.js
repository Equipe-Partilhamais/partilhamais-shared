"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RSStrategy = void 0;
const utils_1 = require("../utils");
const fiscalUnitsApi_1 = require("../../fiscalUnitsApi");
// Lei/RS nº 8.821, de 27/01/1989, arts. 18 (causa mortis) e 19 (doação), na redação do art. 1º
// da Lei nº 14.741, de 24/09/2015, efeitos desde 01/01/2016. Tabela conferida em 09/09/2026 no
// Portal de Serviços da Receita Estadual (https://atendimento.receita.rs.gov.br/como-se-calcula-o-itcd)
// e o texto dos arts. 18 e 19 em https://www.legisweb.com.br/legislacao/?id=153614 — o portal
// da SEFAZ-RS (legislacao.sefaz.rs.gov.br) está com cadeia de certificado incompleta.
//
// O RS NÃO é marginal, e era esse o defeito: o § 1º do art. 18 manda calcular "pela aplicação
// da alíquota correspondente sobre o valor do quinhão", e o § 1º do art. 19 repete a fórmula
// para "o valor da transmissão da doação" — alíquota ÚNICA sobre o todo, não decomposição em
// faixas. Em R$ 1.000.000 o cálculo marginal dava R$ 37.469,60 contra os R$ 50.000,00 da lei.
//
// PENDÊNCIA registrada, fora do alcance desta correção: o art. 18, § 2º, III manda usar a
// UPF-RS vigente na DATA DA AVALIAÇÃO do fisco, e o motor só recebe a data do fato gerador.
// Enquanto a série da UPF-RS tiver um ponto só, o resultado já sai com ressalva de índice.
exports.RSStrategy = {
    calculate({ baseValue, deathDate, taxType }) {
        const safeBaseValue = baseValue || 0;
        const unit = fiscalUnitsApi_1.fiscalUnitsApi.requireUnit('RS', { id: 'UPF_RS', name: 'UPF/RS', value: 27.24 }, deathDate);
        const valueInUpf = safeBaseValue / unit.value;
        const unitInfo = { name: unit.name, value: unit.value, vigenciaInicio: unit.vigenciaInicio };
        let taxInUpf = 0;
        let memory = [];
        let legalText = '';
        if (taxType === 'DOACAO') {
            // Art. 19: faixa I até 10.000 UPF-RS (3%), faixa II acima (4%). Não há faixa de 0%
            // na doação — a tributação começa em 3% desde o primeiro real.
            const result = (0, utils_1.calculateSimpleProgressiveTax)(valueInUpf, [
                { limit: 10000, rate: 0.03 },
                { limit: Infinity, rate: 0.04 }
            ], unitInfo);
            taxInUpf = result.totalTax;
            memory = result.memory;
            legalText = 'Lei/RS nº 8.821/1989, art. 19 (red. Lei nº 14.741/2015). Alíquota única sobre o valor da doação (§ 1º): 3% até 10.000 UPF-RS; 4% acima.';
        }
        else {
            // Art. 18: faixas I a V em UPF-RS. A alíquota da faixa incide sobre o quinhão inteiro.
            const result = (0, utils_1.calculateSimpleProgressiveTax)(valueInUpf, [
                { limit: 2000, rate: 0 },
                { limit: 10000, rate: 0.03 },
                { limit: 30000, rate: 0.04 },
                { limit: 50000, rate: 0.05 },
                { limit: Infinity, rate: 0.06 }
            ], unitInfo);
            taxInUpf = result.totalTax;
            memory = result.memory;
            legalText = 'Lei/RS nº 8.821/1989, art. 18 (red. Lei nº 14.741/2015). Alíquota única sobre o valor do quinhão (§ 1º): 0% até 2.000 UPF-RS; 3% até 10.000; 4% até 30.000; 5% até 50.000; 6% acima.';
        }
        const totalTaxReais = taxInUpf * unit.value;
        return {
            taxAmount: totalTaxReais,
            effectiveRate: safeBaseValue > 0 ? totalTaxReais / safeBaseValue : 0,
            legalText,
            originalTaxAmount: totalTaxReais,
            discountValue: 0,
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
};
