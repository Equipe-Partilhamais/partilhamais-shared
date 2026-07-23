
// Simula uma API que busca os valores atualizados das SEFAZ estaduais.
// Em produção, isso pode conectar a um backend que faz scraping diário.

export interface FiscalUnit {
    id: string;
    name: string;
    value: number;
    lastUpdate: string;
    description: string;
}

// Valores de Referência (Jan/2025 - Estimados/Reais)
const MOCK_UNITS: Record<string, FiscalUnit> = {
    'MT': { id: 'UPF_MT', name: 'UPF/MT', value: 239.51, lastUpdate: '2025-01', description: 'Unidade Padrão Fiscal de Mato Grosso' },
    'RS': { id: 'UPF_RS', name: 'UPF/RS', value: 27.24, lastUpdate: '2025-01', description: 'Unidade Padrão Fiscal do Rio Grande do Sul' },
    'CE': { id: 'UFIRCE', name: 'UFIRCE', value: 5.95, lastUpdate: '2025-01', description: 'Unidade Fiscal de Referência do Ceará' },
    'RJ': { id: 'UFIR_RJ', name: 'UFIR-RJ', value: 4.65, lastUpdate: '2025-01', description: 'Unidade Fiscal de Referência do Rio de Janeiro' },
    'SP': { id: 'UFESP', name: 'UFESP', value: 36.37, lastUpdate: '2025-01', description: 'Unidade Fiscal do Estado de São Paulo' },
    'PB': { id: 'UFR_PB', name: 'UFR-PB', value: 67.89, lastUpdate: '2025-01', description: 'Unidade Fiscal de Referência da Paraíba' }
};

export const fiscalUnitsApi = {
    // Retorna o valor da unidade fiscal para um estado específico
    getUnit: (uf: string): FiscalUnit | null => {
        return MOCK_UNITS[uf] || null;
    },

    // Retorna todas as unidades (para configurações ou debug)
    getAllUnits: (): FiscalUnit[] => {
        return Object.values(MOCK_UNITS);
    },

    // Simula uma atualização forçada (refresh)
    refreshRates: async (): Promise<boolean> => {
        await new Promise(r => setTimeout(r, 1000));
        return true;
    }
};
