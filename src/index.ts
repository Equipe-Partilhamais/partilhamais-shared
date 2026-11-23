// @partilhamais/shared — engine de cálculo compartilhado entre backend e frontend.
// Fonte ÚNICA da lógica de partilha, ITCD e honorários (evita a divergência FE/BE — bug B7).
export * from './services/successionCore';
export * from './services/itcdStrategies';
export * from './services/notaryFeeEngine';
export * from './services/fiscalUnitsApi';
export * from './services/partilha';
export * from './utils/formatters';
export * from './utils/money';
export * from './types';
