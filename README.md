# @partilhamais/shared

Engine de calculo compartilhado (ITCD, honorarios, unidades fiscais) do PartilhaMais.
Fonte UNICA usada por backend e frontend (evita a divergencia de calculo FE/BE).

## Uso

Instalar como git dependency:

    "@partilhamais/shared": "github:Equipe-Partilhamais/partilhamais-shared#main"

(o script `prepare` roda `tsc` no install e gera `dist/`.)

    import { calculateItcdForState, calculateNotaryFees } from "@partilhamais/shared";

## Desenvolvimento

    npm install
    npm test          # vitest (src/__tests__)
    npm run typecheck # tsc --noEmit sobre fonte + testes
    npm run build     # tsc -> dist/ (commitar o dist apos alterar)

O CI (`.github/workflows/ci.yml`) roda typecheck, testes, build e falha se o `dist/`
commitado estiver defasado em relacao ao fonte.

## Confiabilidade das tabelas de ITCD

`calculateItcdForState` devolve `confiabilidade: 'HOMOLOGADA' | 'NAO_CONFIGURADA'`.
`NAO_CONFIGURADA` significa que a aliquota/faixa da UF (ou a tabela de doacao daquela UF)
ainda nao foi conferida contra a lei estadual: o numero e apenas referencial e vem com
`warningMessage` obrigatorio + `pendenciaHomologacao`. **Nao apresente esse valor como
imposto devido sem exibir a ressalva.** O registro fica em
`src/services/itcdStrategies/homologacao.ts` — e o ponto de entrada para receber a tabela
real: codifique a lei na estrategia da UF e vire a flag correspondente.

Para fluxos que produzem documento oficial use `calculateItcdForStateStrict`, que lanca
`ItcdUfNaoConfiguradaError` em vez de devolver numero para UF nao homologada.

As unidades fiscais (`src/services/fiscalUnitsApi.ts`) sao series `{ vigenciaInicio, value }`
resolvidas pela data do fato gerador; quando a serie nao cobre essa data o resultado vem com
`fiscalUnitUsed.outdated = true` e aviso.
