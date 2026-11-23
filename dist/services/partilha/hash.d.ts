import { PartitionResult } from './tipos';
/** String canônica do resultado (ver regras acima). É ela que entra no hash. */
export declare const serializarResultadoCanonico: (resultado: PartitionResult) => string;
/** sha256 em hexadecimal (minúsculo) do texto codificado em UTF-8. */
export declare const sha256Hex: (texto: string) => string;
/**
 * Hash canônico do resultado: `sha256Hex(serializarResultadoCanonico(resultado))`. É o valor que o
 * backend grava como `resultadoHash` e que o frontend compara com o do cálculo que exibe.
 */
export declare const hashDoResultado: (resultado: PartitionResult) => string;
