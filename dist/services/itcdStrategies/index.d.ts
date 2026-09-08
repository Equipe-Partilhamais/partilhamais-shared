import { UF } from '../../types';
import { ItcdTaxType, ItcdResult } from './types';
export * from './homologacao';
export * from './types';
export declare const calculateItcdForState: (uf: UF, baseValue: number, settings: any, deathDate?: string, taxType?: ItcdTaxType) => ItcdResult;
/**
 * Mesma conta, mas recusa devolver número para UF/tipo sem tabela homologada.
 * Use nos fluxos que produzem documento oficial (guia, escritura, petição).
 */
export declare const calculateItcdForStateStrict: (uf: UF, baseValue: number, settings: any, deathDate?: string, taxType?: ItcdTaxType) => ItcdResult;
