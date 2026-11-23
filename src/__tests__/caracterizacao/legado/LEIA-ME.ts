// MOTORES LEGADOS — cópia CONGELADA dos dois `calculatePartition` que existiam antes da
// unificação (CALC-09), usada só pelo teste de caracterização.
//
//   frontend.calculationService.ts  ← partilhamais-frontend/services/calculationService.ts @ 86e83c8
//   frontend.assetValuation.ts      ← partilhamais-frontend/utils/assetValuation.ts
//   frontend.liabilityPartition.ts  ← partilhamais-frontend/utils/liabilityPartition.ts
//   backend.calculationService.ts   ← partilhamais-backend/src/lib/calculationService.ts @ 10bfb1a
//   backend.notaryFees.ts           ← partilhamais-backend/src/lib/notaryFees.ts
//   backend.itcd.ts                 ← partilhamais-backend/src/lib/itcd.ts
//
// O corpo das funções está IGUAL ao original; só os imports foram reescritos para apontar
// para os enums locais (`enums.ts`) e para o núcleo congelado (`nucleoCongelado.ts`). Este
// último guarda os fatores de meação como eram antes do CALC-02 — sem ele, a correção no
// `successionCore` vazaria para dentro do "legado" e a caracterização compararia o motor novo
// com um motor que nunca existiu.
//
// A estratégia de ITCD de cada UF é usada AO VIVO: nesta rodada nenhuma alíquota mudou, só
// textos (CALC-06/CALC-10), e a caracterização compara números, não textos.
//
// Quando os dois apps passarem a importar o motor do shared, esta pasta e o teste de
// caracterização podem ser removidos juntos.
export {};
