import { PartitionAssetInput, PartitionDeceasedInput, PartitionHeirInput } from './tipos';
/**
 * O bem entra na partilha "oficial"? Mesma regra da tela: o campo `includeInOfficial` no topo do
 * bem decide quando é booleano; senão, `otherDetails.includeInOfficial !== false` (ausente = entra).
 */
export declare const isAssetIncludedInOfficialPartition: (asset: Pick<PartitionAssetInput, "includeInOfficial" | "otherDetails">) => boolean;
/** Cadastro que conta como cônjuge/meeiro: o sintético `spouse_auto`, `isSpouse` ou tipo CONJUGE. */
export declare const ehCadastroDeConjuge: (h: Pick<PartitionHeirInput, "id" | "isSpouse" | "type">) => boolean;
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
export declare const montarConjugeDaEntrada: (deceased: Pick<PartitionDeceasedInput, "spouseName" | "maritalRegime" | "spouseQualification"> | null | undefined, heirs: PartitionHeirInput[]) => PartitionHeirInput[];
