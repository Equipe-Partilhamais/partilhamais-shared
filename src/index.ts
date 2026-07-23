// @partilhamais/shared — engine de cálculo compartilhado entre backend e frontend.
// Fonte ÚNICA da lógica de ITCD/honorários (evita a divergência FE/BE — bug B7).
export * from './services/itcdStrategies';
export * from './services/notaryFeeEngine';
export * from './services/fiscalUnitsApi';
export * from './utils/formatters';
export * from './types';
