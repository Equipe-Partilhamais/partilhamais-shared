"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
// Motor de partilha — fonte ÚNICA de `calculatePartition` para o frontend e o backend (CALC-09).
__exportStar(require("./tipos"), exports);
__exportStar(require("./motor"), exports);
__exportStar(require("./competencia"), exports);
__exportStar(require("./valoracao"), exports);
__exportStar(require("./itcdPorBeneficiario"), exports);
// Revisão de integração: montagem da entrada (cônjuge, filtro da partilha oficial).
__exportStar(require("./entrada"), exports);
// Revisão de integração: hash canônico do resultado (Node e navegador).
__exportStar(require("./hash"), exports);
