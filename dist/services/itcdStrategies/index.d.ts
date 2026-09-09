import { UF } from '../../types';
import { ItcdTaxType, ItcdResult } from './types';
export * from './homologacao';
export * from './types';
export declare const calculateItcdForState: (uf: UF, baseValue: number, settings: any, deathDate?: string, taxType?: ItcdTaxType) => ItcdResult;
