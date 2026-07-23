# @partilhamais/shared

Engine de calculo compartilhado (ITCD, honorarios, unidades fiscais) do PartilhaMais.
Fonte UNICA usada por backend e frontend (evita a divergencia de calculo FE/BE).

## Uso

Instalar como git dependency:

    "@partilhamais/shared": "github:Equipe-Partilhamais/partilhamais-shared#main"

(o script `prepare` roda `tsc` no install e gera `dist/`.)

    import { calculateItcdForState, calculateNotaryFees } from "@partilhamais/shared";
