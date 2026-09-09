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

## Vetores dourados (golden) — a rede de seguranca do motor

Dois arquivos guardam o resultado CONGELADO do motor:

| Arquivo | O que congela |
|---|---|
| `src/__tests__/golden.itcd.vetores.jsonl` | `calculateItcdForState` na matriz completa: 27 UFs x {causa mortis, doacao} x bases nos cortes de cada faixa (o corte, o corte -0,01 e o corte +0,01) e nas bases degeneradas (0 / 0,01 / 1 / 100 mil / 1 mi / 10 mi / 50 mi) x 4 datas de fato gerador (inclusive `undefined`, o caminho mais usado) x a flag `applyInventoryDiscount`. Por vetor: imposto, aliquota efetiva, confiabilidade, avisos (e a categoria deles), pendencia, unidade fiscal usada e a memoria de calculo linha a linha. |
| `src/__tests__/golden.sucessao.vetores.jsonl` | `successionCore` cenario a cenario: meacao por regime, descendentes em varias estirpes com representacao, ascendentes por grau e por linha, colaterais (bilateral/unilateral/sobrinhos), renuncia, indignidade e deserdacao, reducao por inoficiosidade e rateio de passivo por UF. Congela o QUINHAO em reais, nao so o peso. |

Eles nao dizem que o imposto esta CERTO — nenhuma UF foi homologada (ver a secao acima).
Dizem que ele e o **mesmo** que ja foi entregue a cliente. Sem isso, nada no repositorio
prova que uma alteracao no motor nao mudou o numero de um caso ja fechado.

A comparacao e ESTRITA (`===`), nunca `toBeCloseTo`: um centavo de diferenca reprova.
A mensagem de falha nomeia a combinacao e mostra o valor antes e depois — numa matriz de
milhares de casos, "esperado != recebido" nao permite agir.

### Regerar apos uma mudanca INTENCIONAL

    npm run golden:gerar        # regera os dois arquivos
    npm run typecheck:golden    # tsc sobre scripts/ (nao entra no dist/)

Depois **leia o diff dos vetores** — e nele, e so nele, que a mudanca fica visivel:

    git diff --stat src/__tests__/*.jsonl     # quantos vetores mudaram
    git diff src/__tests__/golden.itcd.vetores.jsonl | grep '^[-+]{' | head -50

O formato e JSONL (um vetor por linha) exatamente para isso: **uma linha alterada = uma
combinacao alterada**, e o `id` no comeco da linha diz qual (`RJ|DOACAO|325500.00|2025-03-20|SEM_DESC`).
Um diff de 4.896 linhas significa que a mudanca atingiu a matriz inteira; um diff de 12
linhas significa que atingiu 12 casos, e da para conferir um a um antes de aprovar.

Regerar sem ler o diff anula a rede: o teste volta a passar e ninguem descobre quanto
imposto mudou. Descreva no PR **quantos** vetores mudaram e **por que**.

### O portao de invariante

Antes de gravar, o gerador confere que o numero fecha consigo mesmo, e **recusa gravar** se
nao fechar (sai com codigo 2 e nao escreve nada):

- ITCD: a soma da coluna "Imposto" da memoria de calculo = `taxAmount` (e o que o cliente le
  no DOCX); `taxAmount` = `originalTaxAmount` - `discountValue`; `base` x `effectiveRate` =
  `taxAmount`; linha de conversao de unidade fiscal nao gera imposto; imposto nao negativo;
  rotulo de desconto so aparece com valor descontado.
- Sucessorio: a soma dos quinhoes = o monte; pesos de cada estirpe somam 1; nenhum quinhao
  negativo; ninguem pre-morto ou excluido da sucessao recebe quinhao.

Isso e deliberado: o vetor congela o comportamento ATUAL, certo ou errado, e o invariante e
o que separa os dois. Congelar em silencio um total que nao fecha transformaria um defeito
em contrato. Os mesmos invariantes rodam como teste (`golden.*.test.ts`), entao um motor que
passe a nao fechar reprova mesmo sem ninguem regerar nada.

Se a violacao for conhecida e o congelamento for deliberado, existe
`--permitir-invariante-violado` nos dois geradores. Use com registro do porque, nunca para
calar o gerador.

### O que muda os vetores sem ninguem mexer no motor

Estes tres deslocam a matriz inteira e vao aparecer como um diff enorme. E esperado —
so nao pode passar despercebido:

1. **Valor de uma unidade fiscal** (`fiscalUnitsApi.ts`): os cortes de CE, MT, MG, RJ e RS
   sao expressos em UFIRCE/UPF/UFEMG/UFIR-RJ e viram reais pelo indice. A matriz converte
   sempre pela vigencia de `2025-06-15` justamente para que um ponto NOVO na serie nao
   desloque as bases sozinho — mas mudar o valor de 2025 desloca.
2. **Texto de aviso, de norma ou de rotulo de faixa**: sao congelados de proposito. O texto
   do aviso carrega o marcador que `classifyItcdWarning` usa para classificar a ressalva;
   mudar a frase sem mudar o marcador reclassifica a ressalva em silencio, e o campo
   `categoriasAviso` de cada vetor e o que pega isso.
3. **Faixas novas em uma UF**: alem de mudar o imposto, os cortes precisam ser espelhados em
   `CORTES_EM_REAIS` / `CORTES_EM_UNIDADES` (`src/__tests__/golden.matriz.itcd.ts`), senao a
   fronteira nova fica sem vetor e a proxima mudanca nela passa despercebida.

### Limite conhecido do golden sucessorio

`successionCore` e o nucleo COMUM aos dois apps e **nao contem** a regra do art. 1.832
(quanto o conjuge leva concorrendo com descendentes, com o piso de 1/4) nem a colacao de
adiantamentos — as duas continuam escritas dentro de `calculationService.ts` de cada app,
em copias mantidas a mao. O golden daqui congela a distribuicao INTERNA da classe dos
descendentes e o booleano `shouldSpouseCompeteWithDescendants`; o rateio entre conjuge e
descendentes so passa a ser congelavel quando essas regras subirem para este pacote.
