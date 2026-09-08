import { describe, expect, it } from 'vitest';
import { calculateNotaryFees, NotaryFeeRange, NotaryFeeMetadata } from '../services/notaryFeeEngine';

const TABELAS: Record<string, NotaryFeeRange[]> = {
    GO: [
        { min: 0, max: 100_000, deed: 1_000, registry: 500 },
        { min: 100_000, max: null, deed: 2_000, registry: 1_000 },
    ],
    DEFAULT: [{ min: 0, max: null, deed: 800, registry: 400 }],
};

const METADATA: Record<string, NotaryFeeMetadata> = {
    GO: { source: 'Lei 14.376/2002 (Tab. 2024)', lastUpdate: '2024', hasFundsIncluded: true },
    DEFAULT: { source: 'Média Nacional Ponderada', lastUpdate: '2024', hasFundsIncluded: true },
};

describe('motor de emolumentos', () => {
    it('aplica a margem de segurança e devolve a fonte e a competência da tabela', () => {
        const resultado = calculateNotaryFees('GO', 200_000, TABELAS, METADATA);

        expect(resultado.status).toBe('CALCULATED');
        expect(resultado.safetyMargin).toBe(1.05); // hasFundsIncluded
        expect(resultado.deed).toBeCloseTo(2_100, 2);
        expect(resultado.registry).toBeCloseTo(1_050, 2);
        expect(resultado.source).toBe('Lei 14.376/2002 (Tab. 2024)');
        expect(resultado.lastUpdate).toBe('2024');
    });

    // Sem tabela o motor devolve 0 — mas 0 aqui é AUSÊNCIA DE DADO, não emolumento de R$ 0,00.
    // Quem consome só pode formatar como dinheiro quando o status é CALCULATED.
    it('sinaliza tabelas indisponíveis em vez de fingir um valor', () => {
        const resultado = calculateNotaryFees('GO', 200_000);

        expect(resultado.status).toBe('TABLES_UNAVAILABLE');
        expect(resultado.deed).toBe(0);
        expect(resultado.registry).toBe(0);
        expect(resultado.source).toBeUndefined();
    });

    it('cai no DEFAULT marcando isFallback quando a UF não tem tabela própria', () => {
        const resultado = calculateNotaryFees('AM', 50_000, TABELAS, METADATA);

        expect(resultado.status).toBe('CALCULATED');
        expect(resultado.isFallback).toBe(true);
        expect(resultado.deed).toBeCloseTo(840, 2);
    });

    it('RJ usa margem maior por conta dos fundos estaduais', () => {
        const resultado = calculateNotaryFees(
            'RJ',
            50_000,
            { RJ: [{ min: 0, max: null, deed: 1_000, registry: 1_000 }] },
            { RJ: { source: 'Portaria CGJ/RJ', lastUpdate: '2024', hasFundsIncluded: false } }
        );

        expect(resultado.safetyMargin).toBe(1.3);
        expect(resultado.deed).toBeCloseTo(1_300, 2);
    });
});
