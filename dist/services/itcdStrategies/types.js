"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ItcdUfNaoConfiguradaError = void 0;
/** Erro do modo estrito: a UF/tipo pedido não tem tabela homologada, então não há número a devolver. */
class ItcdUfNaoConfiguradaError extends Error {
    constructor(uf, taxType, pendencia) {
        super(`ITCD não homologado para ${uf} (${taxType === 'DOACAO' ? 'doação' : 'causa mortis'}). ` +
            `${pendencia || ''}`.trim());
        this.name = 'ItcdUfNaoConfiguradaError';
        this.uf = uf;
        this.taxType = taxType;
        this.pendencia = pendencia;
    }
}
exports.ItcdUfNaoConfiguradaError = ItcdUfNaoConfiguradaError;
