
import { ItcdStrategy, ItcdStrategyParams, ItcdResult } from '../types';

// DIVERGÊNCIA CONHECIDA, NÃO CORRIGIDA NESTA PASSAGEM. A Lei/PA nº 5.529, de 05/01/1989,
// art. 8º (red. Lei nº 8.868/2019), tem tabela progressiva em UPF-PA — 2/3/4/5/6% nas faixas
// de 15.000/50.000/150.000/350.000 UPF-PA na causa mortis e 2/3/4% em 60.000/120.000 UPF-PA na
// doação. Em R$ 1.000.000 a lei dá R$ 50.000 contra os R$ 40.000 cobrados aqui.
//
// O bloqueio é o insumo, não a pesquisa: as faixas são expressas em UPF-PA e a UPF-PA não
// existe em services/fiscalUnitsApi.ts (arquivo de outra frente). Sem a série da unidade por
// data do fato gerador, converter as faixas com um único valor de 2026 (R$ 5,0155) erraria o
// ENQUADRAMENTO — que é justamente o que define 4% ou 5%. Some-se a isso que o texto do art. 8º
// só foi lido em base privada e que a página oficial de alíquotas da SEFA-PA está desatualizada.
export const PAStrategy: ItcdStrategy = {
    calculate({ baseValue }: ItcdStrategyParams): ItcdResult {
        const safeBaseValue = baseValue || 0;
        const tax = safeBaseValue * 0.04;

        return {
            taxAmount: tax,
            effectiveRate: 0.04,
            legalText: 'ITCD/PA — alíquota de referência de 4%. Tabela estadual não homologada nesta versão.',
            originalTaxAmount: tax,
            discountValue: 0
        };
    }
};
