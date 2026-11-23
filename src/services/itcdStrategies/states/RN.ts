
import { ItcdStrategy, ItcdStrategyParams, ItcdResult } from '../types';

// DIVERGÊNCIA CONHECIDA, NÃO CORRIGIDA. O código cobra 3% fixo, com o texto "Alíquota única de
// 3%" — que a auditoria de 17/11/2026 (cartão CALC-06) apontou como falso: segundo ela, a
// Lei/RN nº 9.993/2015 tem tabela MARGINAL de 3%, 4%, 5% e 6% (em R$ 4 milhões, cerca de
// R$ 195.000 contra os R$ 120.000 daqui — subcobrança). A fonte da auditoria é SECUNDÁRIA:
// a lei não foi lida em fonte primária e as faixas não foram transcritas, por isso a alíquota
// NÃO foi trocada. O texto legal deixou de afirmar a alíquota única, e a UF está registrada
// como DIVERGENCIA_CONHECIDA em `perfilUf.ts` (a minuta exige confirmação explícita).
export const RNStrategy: ItcdStrategy = {
    calculate({ baseValue }: ItcdStrategyParams): ItcdResult {
        const safeBaseValue = baseValue || 0;
        const tax = safeBaseValue * 0.03;

        return {
            taxAmount: tax,
            effectiveRate: 0.03,
            legalText: 'ITCD/RN — 3% aplicados como alíquota de referência, sem tabela estadual conferida. Divergência conhecida (auditoria de 17/11/2026, fonte secundária): a Lei/RN nº 9.993/2015 teria tabela progressiva de 3% a 6%.',
            originalTaxAmount: tax,
            discountValue: 0
        };
    }
};
