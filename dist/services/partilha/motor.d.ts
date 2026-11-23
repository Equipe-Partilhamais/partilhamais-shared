import { PartitionInput, PartitionResult } from './tipos';
/** Versão do motor: grave junto de todo cálculo persistido (snapshot da rota de cálculo). */
export declare const PARTITION_ENGINE_VERSION = "shared-partilha-2026.11.19.2";
export declare const calculatePartition: (data: PartitionInput | null | undefined) => PartitionResult;
