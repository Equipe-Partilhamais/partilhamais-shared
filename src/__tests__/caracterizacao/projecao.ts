// Projeção do resultado do motor em caminhos planos (`alvo[h1].theoreticalValue`,
// `itcd[SP].taxAmount`...) para comparar o motor unificado com os legados campo a campo.

export type ValorProjetado = number | string | boolean | null;
export type Projecao = Record<string, ValorProjetado>;

const TOTAIS_MONETARIOS = [
    'totalAssets', 'totalLiabilities', 'netEstate', 'totalMeacao', 'herancaTotal', 'successionBase',
    'disposablePortion', 'compulsoryPortion', 'testamentaryTotal', 'taxBase', 'taxAmount', 'totalExcessTax',
    'pendingEstateLiabilitiesTotal', 'projectedNetEstate', 'notaryFee', 'deedFee', 'registryFee',
] as const;

const CAMPOS_ALVO = [
    'meacaoValue', 'theoreticalValue', 'advancementValue', 'inheritanceValue', 'legitimaValue',
    'testamentaryValue', 'totalTargetValue', 'percentageOfEstate', 'grossTargetValue', 'grossAllocatedValue',
    'assumedDebtValue', 'allocatedValue', 'excessValue', 'underValue', 'excessTax',
] as const;

const CAMPOS_ITCD = ['taxBase', 'taxAmount', 'registryFee', 'assetCount', 'originalTaxAmount', 'discountValue', 'effectiveRate'] as const;

const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : v == null ? null : NaN);

export const projetar = (r: any): Projecao => {
    const p: Projecao = {};
    TOTAIS_MONETARIOS.forEach(k => { p[`total.${k}`] = num(r[k]); });
    p['total.isTestamentaryExcessive'] = !!r.isTestamentaryExcessive;

    (r.targets || []).forEach((t: any) => {
        CAMPOS_ALVO.forEach(f => { p[`alvo[${t.personId}].${f}`] = num(t[f] ?? 0); });
        p[`alvo[${t.personId}].personType`] = String(t.personType);
    });

    (r.itcdBreakdown || []).forEach((i: any) => {
        CAMPOS_ITCD.forEach(f => { p[`itcd[${i.state}].${f}`] = num(i[f] ?? 0); });
        p[`itcd[${i.state}].confiabilidade`] = i.confiabilidade ?? null;
        p[`itcd[${i.state}].regras`] = (i.competenceRules || []).map((c: any) => c.rule).sort().join(',');
    });

    const doacoes = new Map<string, { value: number; taxAmount: number }>();
    (r.donationBreakdown || []).forEach((e: any) => {
        const chave = `${e.donorId}>${e.receiverId}@${e.donorState}`;
        const atual = doacoes.get(chave) || { value: 0, taxAmount: 0 };
        atual.value += e.value;
        atual.taxAmount += e.taxAmount;
        doacoes.set(chave, atual);
    });
    doacoes.forEach((v, chave) => {
        p[`doacao[${chave}].value`] = v.value;
        p[`doacao[${chave}].taxAmount`] = v.taxAmount;
    });

    return p;
};

/**
 * Tolerância por campo. Dinheiro: 1 centavo (o motor unificado arredonda a centavo — CALC-08 —
 * e reparte pelo maior resto, então cada parte fica no piso ou no teto do valor exato). ITCD
 * somado: 5 centavos, porque o total da UF passou a ser a soma de guias arredondadas por
 * beneficiário. Percentual: 4 casas. Alíquota efetiva: 6 casas.
 */
const tolerancia = (caminho: string): number => {
    if (caminho.endsWith('.percentageOfEstate')) return 1e-4 + 1e-9;
    if (caminho.endsWith('.effectiveRate')) return 1e-6;
    if (caminho.endsWith('.assetCount')) return 0;
    if (/taxAmount|originalTaxAmount|excessTax|totalExcessTax/.test(caminho)) return 0.05 + 1e-6;
    return 0.01 + 1e-6;
};

export interface Diferenca {
    caminho: string;
    legado: ValorProjetado | undefined;
    unificado: ValorProjetado | undefined;
}

export const compararProjecoes = (legado: Projecao, unificado: Projecao, ignorar: (caminho: string) => boolean = () => false): Diferenca[] => {
    const caminhos = Array.from(new Set([...Object.keys(legado), ...Object.keys(unificado)])).sort();
    const diferencas: Diferenca[] = [];
    caminhos.forEach(caminho => {
        if (ignorar(caminho)) return;
        const a = legado[caminho];
        const b = unificado[caminho];
        // Linha de UF/doação que existe de um lado só com tudo zerado não é diferença de número.
        const ausenteOuZero = (v: ValorProjetado | undefined) => v === undefined || v === 0 || v === '' || v === null;
        if (a === undefined || b === undefined) {
            if (ausenteOuZero(a) && ausenteOuZero(b)) return;
            diferencas.push({ caminho, legado: a, unificado: b });
            return;
        }
        if (typeof a === 'number' && typeof b === 'number') {
            if (Number.isNaN(a) || Number.isNaN(b) || Math.abs(a - b) > tolerancia(caminho)) diferencas.push({ caminho, legado: a, unificado: b });
            return;
        }
        if (a !== b) diferencas.push({ caminho, legado: a, unificado: b });
    });
    return diferencas;
};

export const descreverDiferencas = (diferencas: Diferenca[]): string =>
    diferencas.map(d => `      ${d.caminho}: legado=${JSON.stringify(d.legado)} unificado=${JSON.stringify(d.unificado)}`).join('\n');
