
import { calculateNotaryFees, NotaryFeeResult } from './nucleoCongelado';

export interface FeeRange {
    min: number;
    max: number | null;
    deed: number;     // Valor da Escritura (Tabelionato de Notas)
    registry: number; // Valor do Registro (Registro de Imóveis)
}

export interface FeeMetadata {
    source: string;
    lastUpdate: string;
    hasFundsIncluded: boolean; // Se o valor já inclui taxas de fiscalização/fundos
}

export const TABLE_METADATA: Record<string, FeeMetadata> = {
    'SP': { source: 'Lei Estadual 11.331/2002 (Tab. 2025)', lastUpdate: '2025', hasFundsIncluded: false },
    'MG': { source: 'Lei 15.424/2004 (Portaria CGJ 2024)', lastUpdate: '2024', hasFundsIncluded: true },
    'RJ': { source: 'Portaria CGJ/RJ (Tab. 2024)', lastUpdate: '2024', hasFundsIncluded: false }, // RJ tem muitas taxas extras (20% a 40%)
    'RS': { source: 'Lei 12.692/2006 (Tab. 2024)', lastUpdate: '2024', hasFundsIncluded: true },
    'PR': { source: 'Lei 20.374/2020 (Tab. 2024)', lastUpdate: '2024', hasFundsIncluded: true },
    'SC': { source: 'Lei Comp. 755/2019 (Tab. 2024)', lastUpdate: '2024', hasFundsIncluded: true },
    'BA': { source: 'Lei 12.373/2011 (Tab. 2024)', lastUpdate: '2024', hasFundsIncluded: true },
    'GO': { source: 'Lei 14.376/2002 (Tab. 2024)', lastUpdate: '2024', hasFundsIncluded: true },
    'DF': { source: 'Regimento de Custas (Tab. 2024)', lastUpdate: '2024', hasFundsIncluded: true },
    'PE': { source: 'Lei 11.404/1996 (Tab. 2024)', lastUpdate: '2024', hasFundsIncluded: true },
    'DEFAULT': { source: 'Média Nacional Ponderada', lastUpdate: '2024', hasFundsIncluded: true }
};

// VALORES REAIS APROXIMADOS (Base 2024/2025)
export const NOTARY_TABLES: Record<string, FeeRange[]> = {
    'SP': [ // São Paulo 2025 (Valores Base)
        { min: 0, max: 1605, deed: 290, registry: 290 },
        { min: 1605, max: 6420, deed: 680, registry: 680 },
        { min: 6420, max: 21400, deed: 1650, registry: 1650 },
        { min: 21400, max: 42800, deed: 2800, registry: 2800 },
        { min: 42800, max: 85600, deed: 4600, registry: 4600 },
        { min: 85600, max: 171200, deed: 7300, registry: 7300 },
        { min: 171200, max: 342400, deed: 10500, registry: 10500 },
        { min: 342400, max: 1712000, deed: 18000, registry: 18000 },
        { min: 1712000, max: 5000000, deed: 27000, registry: 27000 },
        { min: 5000000, max: null, deed: 68000, registry: 68000 }
    ],
    'MG': [ // Minas Gerais 2024 (Reais com TFJ incluso na estimativa)
        { min: 0, max: 1400, deed: 257, registry: 257 },
        { min: 1400, max: 2800, deed: 432, registry: 432 },
        { min: 2800, max: 14000, deed: 1010, registry: 1010 },
        { min: 14000, max: 28000, deed: 1950, registry: 1950 },
        { min: 28000, max: 70000, deed: 3100, registry: 3100 },
        { min: 70000, max: 280000, deed: 4800, registry: 4800 },
        { min: 280000, max: 560000, deed: 6500, registry: 6500 },
        { min: 560000, max: 1400000, deed: 9900, registry: 9900 },
        { min: 1400000, max: null, deed: 13500, registry: 13500 }
    ],
    'RJ': [ // Rio de Janeiro (Valores altos + 20% FETJ + 5% FUNPERJ + 5% FUNARPEN)
        { min: 0, max: 15000, deed: 500, registry: 500 },
        { min: 15000, max: 30000, deed: 900, registry: 900 },
        { min: 30000, max: 60000, deed: 1600, registry: 1600 },
        { min: 60000, max: 100000, deed: 3200, registry: 3200 },
        { min: 100000, max: 200000, deed: 4800, registry: 4800 },
        { min: 200000, max: 400000, deed: 6500, registry: 6500 },
        { min: 400000, max: 1000000, deed: 9500, registry: 9500 },
        { min: 1000000, max: null, deed: 16000, registry: 16000 }
    ],
    'RS': [ // Rio Grande do Sul
        { min: 0, max: 10000, deed: 200, registry: 200 },
        { min: 10000, max: 40000, deed: 650, registry: 650 },
        { min: 40000, max: 100000, deed: 1400, registry: 1400 },
        { min: 100000, max: 200000, deed: 2200, registry: 2200 },
        { min: 200000, max: 400000, deed: 3100, registry: 3100 },
        { min: 400000, max: 900000, deed: 4200, registry: 4200 },
        { min: 900000, max: null, deed: 6000, registry: 6000 } 
    ],
    'PR': [ // Paraná
        { min: 0, max: 15000, deed: 280, registry: 280 },
        { min: 15000, max: 30000, deed: 500, registry: 500 },
        { min: 30000, max: 60000, deed: 850, registry: 850 },
        { min: 60000, max: 120000, deed: 1200, registry: 1200 },
        { min: 120000, max: null, deed: 1800, registry: 1800 } 
    ],
    'SC': [ // Santa Catarina (Regimento de Custas e Emolumentos)
        { min: 0, max: 15000, deed: 380, registry: 380 },
        { min: 15000, max: 45000, deed: 800, registry: 800 },
        { min: 45000, max: 100000, deed: 1300, registry: 1300 },
        { min: 100000, max: 300000, deed: 2100, registry: 2100 },
        { min: 300000, max: 800000, deed: 3800, registry: 3800 },
        { min: 800000, max: null, deed: 5500, registry: 5500 }
    ],
    'BA': [ // Bahia
        { min: 0, max: 20000, deed: 400, registry: 400 },
        { min: 20000, max: 60000, deed: 900, registry: 900 },
        { min: 60000, max: 150000, deed: 1800, registry: 1800 },
        { min: 150000, max: 300000, deed: 3200, registry: 3200 },
        { min: 300000, max: null, deed: 6000, registry: 6000 }
    ],
    'GO': [ // Goiás
        { min: 0, max: 20000, deed: 500, registry: 500 },
        { min: 20000, max: 60000, deed: 1200, registry: 1200 },
        { min: 60000, max: 150000, deed: 2500, registry: 2500 },
        { min: 150000, max: 400000, deed: 4500, registry: 4500 },
        { min: 400000, max: null, deed: 7800, registry: 7800 }
    ],
    'DF': [ // Distrito Federal
        { min: 0, max: 15000, deed: 300, registry: 300 },
        { min: 15000, max: 40000, deed: 700, registry: 700 },
        { min: 40000, max: 100000, deed: 1500, registry: 1500 },
        { min: 100000, max: 300000, deed: 2500, registry: 2500 },
        { min: 300000, max: null, deed: 4000, registry: 4000 }
    ],
    'PE': [ // Pernambuco
        { min: 0, max: 20000, deed: 450, registry: 450 },
        { min: 20000, max: 50000, deed: 1000, registry: 1000 },
        { min: 50000, max: 150000, deed: 2200, registry: 2200 },
        { min: 150000, max: null, deed: 5000, registry: 5000 }
    ],
    'DEFAULT': [ // Média Nacional para estados não listados
        { min: 0, max: 20000, deed: 450, registry: 450 },
        { min: 20000, max: 50000, deed: 1100, registry: 1100 },
        { min: 50000, max: 100000, deed: 2200, registry: 2200 },
        { min: 100000, max: 300000, deed: 3800, registry: 3800 },
        { min: 300000, max: 800000, deed: 6000, registry: 6000 },
        { min: 800000, max: 2000000, deed: 9000, registry: 9000 },
        { min: 2000000, max: null, deed: 13000, registry: 13000 }
    ]
};

// Devolve o resultado completo do motor. O `status` precisa chegar ao consumidor: quando ele
// não é 'CALCULATED', `deed` e `registry` valem 0 por AUSÊNCIA de tabela, e imprimir R$ 0,00
// como emolumento devido é o mesmo defeito que a auditoria apontou no relatório do cliente.
export const getNotaryFees = (uf: string, value: number): NotaryFeeResult => {
    return calculateNotaryFees(uf, value, NOTARY_TABLES, TABLE_METADATA);
};

export const getTableMetadata = (uf: string) => {
    return TABLE_METADATA[uf] || TABLE_METADATA['DEFAULT'];
};
