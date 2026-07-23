export interface NotaryFeeRange {
  min: number;
  max: number | null;
  deed: number;
  registry: number;
}

export interface NotaryFeeMetadata {
  source: string;
  lastUpdate: string;
  hasFundsIncluded: boolean;
}

export interface NotaryFeeResult {
  deed: number;
  registry: number;
  rangeLabel: string;
  isFallback: boolean;
  status: 'CALCULATED' | 'TABLES_UNAVAILABLE' | 'INVALID_TABLE';
}

const unavailableResult = (status: NotaryFeeResult['status'], label: string): NotaryFeeResult => ({
  deed: 0,
  registry: 0,
  rangeLabel: label,
  isFallback: false,
  status,
});

/** Pure canonical engine used by both frontend and backend. */
export const calculateNotaryFees = (
  uf: string,
  value: number,
  tables?: Record<string, NotaryFeeRange[]>,
  metadata?: Record<string, NotaryFeeMetadata>,
): NotaryFeeResult => {
  if (!tables || Object.keys(tables).length === 0) {
    return unavailableResult('TABLES_UNAVAILABLE', 'Tabelas indisponíveis');
  }

  const stateTable = tables[uf];
  const table = stateTable || tables.DEFAULT;
  if (!table?.length) {
    return unavailableResult('INVALID_TABLE', 'Estado não suportado');
  }

  const safeValue = Number.isFinite(value) && value > 0 ? value : 0;
  const range = table.find(item => safeValue >= item.min && (item.max === null || safeValue <= item.max));
  if (!range) {
    return unavailableResult('INVALID_TABLE', 'Faixa não encontrada');
  }

  const meta = metadata?.[uf] || metadata?.DEFAULT;
  let safetyMargin = 1.15;
  if (uf === 'RJ') safetyMargin = 1.30;
  if (meta?.hasFundsIncluded) safetyMargin = 1.05;

  return {
    deed: (range.deed || 0) * safetyMargin,
    registry: (range.registry || 0) * safetyMargin,
    rangeLabel: `Faixa: ${range.min.toLocaleString('pt-BR')} a ${range.max === null ? 'Acima' : range.max.toLocaleString('pt-BR')}`,
    isFallback: !stateTable,
    status: 'CALCULATED',
  };
};
