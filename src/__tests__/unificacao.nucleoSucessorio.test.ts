import { describe, expect, it } from 'vitest';
import {
    buildCollateralShares,
    buildDescendantSharesWithRepresentation,
    callAscendants,
    getCommonEstateFactor,
    getPrivateEstateFactor,
    inofficiousReductionFactors,
    isPreCompetenceChangeDeath,
    shouldSpouseCompeteWithDescendants,
    splitAmongAscendants,
    spouseShareWithAscendants,
    SuccessionHeir,
    allocateDebtByState,
} from '../services/successionCore';

// Este arquivo cobre o núcleo que ANTES existia em duas cópias mantidas à mão (motor do
// frontend e do backend). Os casos são os mesmos do teste de paridade dos apps.

const herdeiro = (over: Partial<SuccessionHeir> & { id: string }): SuccessionHeir => ({
    name: over.id,
    type: 'DESCENDENTE',
    ...over,
});

const pesos = (membros: { heir: SuccessionHeir; weight: number }[]) =>
    Object.fromEntries(membros.map(m => [m.heir.id, m.weight]));

describe('vocação hereditária — descendentes', () => {
    it('filho vivo forma uma estirpe própria; pré-morto é representado pelos seus (art. 1.851)', () => {
        const heirs = [
            herdeiro({ id: 'f1', subtype: 'FILHO' }),
            herdeiro({ id: 'f2', subtype: 'FILHO', isPreDeceased: true }),
            herdeiro({ id: 'n1', subtype: 'NETO', parentId: 'f2' }),
            herdeiro({ id: 'n2', subtype: 'NETO', parentId: 'f2' }),
        ];

        const { stirpes } = buildDescendantSharesWithRepresentation(heirs);

        expect(stirpes.map(s => s.childId)).toEqual(['f1', 'f2']);
        expect(pesos(stirpes[1].members)).toEqual({ n1: 0.5, n2: 0.5 });
    });

    it('representação desce até bisnetos dividindo por estirpe, não por cabeça (art. 1.855)', () => {
        const heirs = [
            herdeiro({ id: 'f2', subtype: 'FILHO', isPreDeceased: true }),
            herdeiro({ id: 'n1', subtype: 'NETO', parentId: 'f2' }),
            herdeiro({ id: 'n2', subtype: 'NETO', parentId: 'f2', isPreDeceased: true }),
            herdeiro({ id: 'b1', subtype: 'NETO', parentId: 'n2' }),
            herdeiro({ id: 'b2', subtype: 'NETO', parentId: 'n2' }),
        ];

        const { stirpes } = buildDescendantSharesWithRepresentation(heirs);

        // n1 leva metade do ramo; os dois bisnetos dividem a outra metade.
        expect(pesos(stirpes[0].members)).toEqual({ n1: 0.5, b1: 0.25, b2: 0.25 });
    });

    it('ninguém representa renunciante, mas o indigno é representado (arts. 1.811/1.816)', () => {
        const heirs = [
            herdeiro({ id: 'f1', subtype: 'FILHO', successionExclusion: 'RENUNCIA' }),
            herdeiro({ id: 'n1', subtype: 'NETO', parentId: 'f1' }),
            herdeiro({ id: 'f2', subtype: 'FILHO', successionExclusion: 'INDIGNIDADE' }),
            herdeiro({ id: 'n2', subtype: 'NETO', parentId: 'f2' }),
            herdeiro({ id: 'f3', subtype: 'FILHO' }),
        ];

        const { stirpes } = buildDescendantSharesWithRepresentation(heirs);

        expect(stirpes.map(s => s.childId)).toEqual(['f2', 'f3']);
        expect(pesos(stirpes[0].members)).toEqual({ n2: 1 });
    });

    it('renunciando toda a classe, os filhos dos renunciantes herdam por cabeça (art. 1.811)', () => {
        const heirs = [
            herdeiro({ id: 'f1', subtype: 'FILHO', successionExclusion: 'RENUNCIA' }),
            herdeiro({ id: 'n1', subtype: 'NETO', parentId: 'f1' }),
            herdeiro({ id: 'n2', subtype: 'NETO', parentId: 'f1' }),
        ];

        const { stirpes } = buildDescendantSharesWithRepresentation(heirs);

        expect(stirpes.map(s => s.childId)).toEqual(['n1', 'n2']);
    });

    it('ciclo em parentId não trava a recursão', () => {
        const heirs = [
            herdeiro({ id: 'f1', subtype: 'FILHO', isPreDeceased: true, parentId: 'n1' }),
            herdeiro({ id: 'n1', subtype: 'NETO', parentId: 'f1', isPreDeceased: true }),
        ];

        expect(() => buildDescendantSharesWithRepresentation(heirs)).not.toThrow();
        expect(buildDescendantSharesWithRepresentation(heirs).stirpes).toEqual([]);
    });
});

describe('vocação hereditária — ascendentes e cônjuge', () => {
    it('o grau mais próximo exclui o mais remoto (art. 1.836, §1º)', () => {
        const ascendentes = [
            herdeiro({ id: 'mae', type: 'ASCENDENTE', subtype: 'PAI' }),
            herdeiro({ id: 'avo1', type: 'ASCENDENTE', subtype: 'AVO' }),
            herdeiro({ id: 'avo2', type: 'ASCENDENTE', subtype: 'AVO' }),
        ];

        const { degree, called } = callAscendants(ascendentes);

        expect(degree).toBe(1);
        expect(called.map(a => a.id)).toEqual(['mae']);
    });

    it('metade por linha quando há diversidade de linha no mesmo grau (art. 1.836, §2º)', () => {
        const called = [
            herdeiro({ id: 'p1', type: 'ASCENDENTE', subtype: 'AVO', ascendantLine: 'PATERNA' }),
            herdeiro({ id: 'p2', type: 'ASCENDENTE', subtype: 'AVO', ascendantLine: 'PATERNA' }),
            herdeiro({ id: 'm1', type: 'ASCENDENTE', subtype: 'AVO', ascendantLine: 'MATERNA' }),
        ];

        expect(Object.fromEntries(splitAmongAscendants(called, 1200))).toEqual({ p1: 300, p2: 300, m1: 600 });
    });

    it('sem a linha informada mantém-se o rateio por cabeça', () => {
        const called = [
            herdeiro({ id: 'a1', type: 'ASCENDENTE', subtype: 'AVO' }),
            herdeiro({ id: 'a2', type: 'ASCENDENTE', subtype: 'AVO' }),
        ];

        expect(Object.fromEntries(splitAmongAscendants(called, 1000))).toEqual({ a1: 500, a2: 500 });
    });

    it('1/3 ao cônjuge só com ambos os ascendentes de 1º grau (art. 1.837)', () => {
        expect(spouseShareWithAscendants(1, 2)).toBeCloseTo(1 / 3, 10);
        expect(spouseShareWithAscendants(1, 1)).toBe(0.5);
        expect(spouseShareWithAscendants(2, 4)).toBe(0.5);
    });

    it('concorrência do cônjuge com descendentes depende do regime (art. 1.829, I)', () => {
        expect(shouldSpouseCompeteWithDescendants('COMUNHAO_UNIVERSAL', true)).toBe(false);
        expect(shouldSpouseCompeteWithDescendants('SEPARACAO_OBRIGATORIA', true)).toBe(false);
        expect(shouldSpouseCompeteWithDescendants('COMUNHAO_PARCIAL', true)).toBe(true);
        expect(shouldSpouseCompeteWithDescendants('COMUNHAO_PARCIAL', false)).toBe(false);
        expect(shouldSpouseCompeteWithDescendants('SEPARACAO_TOTAL', false)).toBe(true);
    });
});

describe('vocação hereditária — colaterais', () => {
    it('irmão bilateral leva o dobro do unilateral (arts. 1.841/1.843, §2º)', () => {
        const colaterais = [
            herdeiro({ id: 'bi', type: 'COLATERAL', subtype: 'IRMAO' }),
            herdeiro({ id: 'uni', type: 'COLATERAL', subtype: 'IRMAO', siblingBond: 'UNILATERAL' }),
        ];

        expect(pesos(buildCollateralShares(colaterais))).toEqual({ bi: 2, uni: 1 });
    });

    it('sobrinho só entra representando o pai pré-morto (arts. 1.840/1.853)', () => {
        const colaterais = [
            herdeiro({ id: 'irmao', type: 'COLATERAL', subtype: 'IRMAO' }),
            herdeiro({ id: 'morto', type: 'COLATERAL', subtype: 'IRMAO', siblingBond: 'UNILATERAL', isPreDeceased: true }),
            herdeiro({ id: 'sob1', type: 'COLATERAL', subtype: 'SOBRINHO', parentId: 'morto' }),
            herdeiro({ id: 'sob2', type: 'COLATERAL', subtype: 'SOBRINHO', parentId: 'morto' }),
            herdeiro({ id: 'avulso', type: 'COLATERAL', subtype: 'SOBRINHO' }),
        ];

        expect(pesos(buildCollateralShares(colaterais))).toEqual({ irmao: 2, sob1: 0.5, sob2: 0.5 });
    });

    it('sem irmãos vivos, os sobrinhos herdam por cabeça com o peso do vínculo do pai', () => {
        const colaterais = [
            herdeiro({ id: 'bi', type: 'COLATERAL', subtype: 'IRMAO', isPreDeceased: true }),
            herdeiro({ id: 'uni', type: 'COLATERAL', subtype: 'IRMAO', siblingBond: 'UNILATERAL', isPreDeceased: true }),
            herdeiro({ id: 'sobBi', type: 'COLATERAL', subtype: 'SOBRINHO', parentId: 'bi' }),
            herdeiro({ id: 'sobUni', type: 'COLATERAL', subtype: 'SOBRINHO', parentId: 'uni' }),
        ];

        // Os pesos são relativos (o motor normaliza depois): 2 para o filho do bilateral,
        // 1 para o do unilateral.
        expect(pesos(buildCollateralShares(colaterais))).toEqual({ sobBi: 2, sobUni: 1 });
    });
});

describe('redução das disposições inoficiosas (art. 1.967)', () => {
    it('não reduz nada quando o testamento cabe na disponível', () => {
        expect(inofficiousReductionFactors([{ kind: 'QUOTA', value: 300 }], 600)).toEqual({ quota: 1, legacy: 1 });
    });

    it('reduz primeiro as quotas e só depois os legados (§1º)', () => {
        const fatores = inofficiousReductionFactors(
            [{ kind: 'QUOTA', value: 400 }, { kind: 'LEGADO', value: 200 }],
            400
        );

        expect(fatores).toEqual({ quota: 0.5, legacy: 1 });
    });

    it('zera as quotas e corta os legados quando a redução das quotas não basta', () => {
        const fatores = inofficiousReductionFactors(
            [{ kind: 'QUOTA', value: 200 }, { kind: 'LEGADO', value: 800 }],
            400
        );

        expect(fatores.quota).toBe(0);
        expect(fatores.legacy).toBeCloseTo(0.5, 10);
    });
});

describe('fatores de meação e marco de competência', () => {
    it('sem cônjuge não há meação, qualquer que seja o regime', () => {
        expect(getCommonEstateFactor('COMUNHAO_UNIVERSAL', false)).toBe(1);
        expect(getPrivateEstateFactor('COMUNHAO_UNIVERSAL', false)).toBe(1);
    });

    it('comunhão parcial mea o comum e preserva o particular', () => {
        expect(getCommonEstateFactor('COMUNHAO_PARCIAL', true)).toBe(0.5);
        expect(getPrivateEstateFactor('COMUNHAO_PARCIAL', true)).toBe(1);
    });

    it('comunhão universal mea também o particular', () => {
        expect(getPrivateEstateFactor('COMUNHAO_UNIVERSAL', true)).toBe(0.5);
    });

    it('EC 132/2023: o critério muda em 20/12/2023', () => {
        expect(isPreCompetenceChangeDeath('2023-12-19')).toBe(true);
        expect(isPreCompetenceChangeDeath('2023-12-20')).toBe(false);
        expect(isPreCompetenceChangeDeath(undefined)).toBe(false);
    });

    it('rateio do passivo do espólio é proporcional ao acervo de cada UF', () => {
        const acervo = new Map([['MG', 300], ['SP', 100]]);

        expect(Object.fromEntries(allocateDebtByState(acervo, 200))).toEqual({ MG: 150, SP: 50 });
        // Dívida maior que o acervo da UF não produz base negativa.
        expect(Object.fromEntries(allocateDebtByState(new Map([['MG', 100]]), 400))).toEqual({ MG: 0 });
    });
});
