import { PartitionAssetInput, PartitionDeceasedInput, PartitionHeirInput } from './tipos';

// MONTAGEM DA ENTRADA — regras que os dois apps aplicavam cada um do seu jeito antes de chamar o
// motor (revisão de integração, itens 2 e 3). Ficam aqui para que tela, minuta e servidor montem
// a mesma entrada; o próprio `calculatePartition` as aplica, então chamar ou não chamar antes dá
// o mesmo resultado.

/**
 * O bem entra na partilha "oficial"? Mesma regra da tela: o campo `includeInOfficial` no topo do
 * bem decide quando é booleano; senão, `otherDetails.includeInOfficial !== false` (ausente = entra).
 */
export const isAssetIncludedInOfficialPartition = (asset: Pick<PartitionAssetInput, 'includeInOfficial' | 'otherDetails'>): boolean => {
    if (typeof asset.includeInOfficial === 'boolean') return asset.includeInOfficial;
    return asset.otherDetails?.includeInOfficial !== false;
};

/** Cadastro que conta como cônjuge/meeiro: o sintético `spouse_auto`, `isSpouse` ou tipo CONJUGE. */
export const ehCadastroDeConjuge = (h: Pick<PartitionHeirInput, 'id' | 'isSpouse' | 'type'>): boolean =>
    h.id === 'spouse_auto' || !!h.isSpouse || h.type === 'CONJUGE';

// Prioridade para escolher O cônjuge quando há mais de um cadastro (o motor avisa e trava nesse
// caso): o sintético da tela, depois o marcado com isSpouse, depois o de tipo CONJUGE; empate pelo id.
const prioridade = (h: PartitionHeirInput) => (h.id === 'spouse_auto' ? 0 : h.isSpouse ? 1 : 2);

/**
 * Herdeiros com o cônjuge montado a partir do falecido. A tela guarda a qualificação do cônjuge
 * (renúncia, indignidade, UF de residência, domicílio no exterior...) em
 * `deceased.spouseQualification` e não grava o cônjuge sintético `spouse_auto` como herdeiro; o
 * servidor não lia isso e calculava outro caso (renúncia ignorada).
 *
 * - Sem `spouseName` ou com regime SOLTEIRO/ausente: herdeiros inalterados.
 * - Com um cadastro de cônjuge: a qualificação do falecido completa e prevalece sobre ele (é a
 *   fonte única na tela); só entram as chaves definidas — `null` limpa, ausente não mexe.
 * - Sem cadastro: acrescenta `spouse_auto` com a qualificação, `name = spouseName`, tipo CONJUGE.
 */
export const montarConjugeDaEntrada = (
    deceased: Pick<PartitionDeceasedInput, 'spouseName' | 'maritalRegime' | 'spouseQualification'> | null | undefined,
    heirs: PartitionHeirInput[]
): PartitionHeirInput[] => {
    if (!deceased?.spouseName || !deceased.maritalRegime || deceased.maritalRegime === 'SOLTEIRO') return heirs;

    const qualificacao: Partial<PartitionHeirInput> = {};
    Object.entries(deceased.spouseQualification || {}).forEach(([chave, valor]) => {
        if (valor === undefined || chave === 'id' || chave === 'type' || chave === 'name' || chave === 'isSpouse') return;
        (qualificacao as Record<string, unknown>)[chave] = valor;
    });

    const candidatos = heirs.filter(ehCadastroDeConjuge);
    if (candidatos.length > 0) {
        const principal = [...candidatos].sort((a, b) => prioridade(a) - prioridade(b) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))[0];
        return heirs.map(h => (h === principal ? { ...h, ...qualificacao } : h));
    }

    return [
        ...heirs,
        { ...qualificacao, id: 'spouse_auto', name: deceased.spouseName, type: 'CONJUGE', isSpouse: true, subtype: qualificacao.subtype ?? 'OUTRO' },
    ];
};
