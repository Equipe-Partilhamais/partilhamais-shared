import { describe, expect, it } from 'vitest';
import * as shared from '../index';
import { bem, caso, filho } from './caracterizacao/cenarios';

// CALC-09: o motor de partilha passa a ser exportado pelo pacote — os dois apps importam daqui
// e apagam as cópias próprias de `calculatePartition`.

describe('CALC-09 — API pública do motor único', () => {
    it('exporta o motor, a competência, a valoração, o ITCD por beneficiário e os utilitários de centavos', () => {
        const nomes = [
            'calculatePartition',
            'PARTITION_ENGINE_VERSION',
            'resolveAssetItcdCompetence',
            'resolveAssetItcdState',
            'ITCD_COMPETENCE_RULES',
            'ITCD_COMPETENCE_CHANGE_DATE',
            'isForeignConnectionRule',
            'getAssetEffectiveValue',
            'normalizeLiability',
            'calcularItcdDaUf',
            'arredondarResultadoItcd',
            'PERFIL_ITCD_UF',
            'getPerfilItcdUf',
            'toCents',
            'distributeCents',
            'toFraction',
            // Revisão de integração: montagem da entrada e hash canônico do resultado.
            'montarConjugeDaEntrada',
            'isAssetIncludedInOfficialPartition',
            'hashDoResultado',
            'serializarResultadoCanonico',
            'sha256Hex',
        ];
        nomes.forEach(nome => expect(shared, nome).toHaveProperty(nome));
    });

    it('o resultado traz a versão do motor para o snapshot', () => {
        const r = shared.calculatePartition(caso({ heirs: [filho('f1')], assets: [bem('imovel', 100_000)] }));
        expect(r.engineVersion).toBe(shared.PARTITION_ENGINE_VERSION);
    });

    it('sem tabela de emolumentos, o R$ 0,00 vem com aviso e status — não com cara de emolumento devido', () => {
        const r = shared.calculatePartition(caso({ heirs: [filho('f1')], assets: [bem('imovel', 100_000)], semTabelas: true }));
        expect(r.notaryFeeStatus).toBe('TABLES_UNAVAILABLE');
        expect(r.deedFee).toBe(0);
        expect(r.avisos).toEqual(expect.arrayContaining([expect.objectContaining({ codigo: 'EMOLUMENTOS_NAO_CALCULADOS', categoria: 'EMOLUMENTOS' })]));
    });

    it('entrada vazia devolve resultado vazio completo, sem lançar', () => {
        const r = shared.calculatePartition(null);
        expect(r.targets).toEqual([]);
        expect(r.minuta).toEqual({ exigeConfirmacao: false, motivos: [] });
    });
});
