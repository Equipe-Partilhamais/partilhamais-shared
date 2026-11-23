# HANDOFF: motor de cálculo (`partilhamais-shared`)

> Branch **`fix/auditoria-2026-11`**. Estado em 23/11/2026.
> Este repositório é **público**: aqui só entra o que diz respeito ao motor de cálculo. O HANDOFF completo do projeto fica no repositório privado `partilhamais-backend` (mesma branch). Quem tem acesso deve lê-lo.

## 1. O que esta branch traz

- **Motor de partilha único:** `calculatePartition`, em `src/services/partilha/`. Frontend e backend passam a só chamá-lo, por adaptadores. `PARTITION_ENGINE_VERSION = shared-partilha-2026.11.19.2`.
- **ITCD por quinhão:** uma guia por beneficiário e por UF (CTN art. 35). O arredondamento é feito guia a guia; por isso SP 1 mi / 3 herdeiros dá 39.999,99.
- **Meação e legítima:**
  - na comunhão universal, a meação incide só sobre o bem comum (CC arts. 1.667/1.668);
  - legítima e parte disponível são calculadas sobre o monte líquido. O passivo é dividido na proporção do quinhão (art. 1.997), e a inoficiosidade é reduzida pela ordem do art. 1.967 §1º.
- **Competência:**
  - domicílio não informado deixa a competência indeterminada, com aviso e trava da minuta;
  - falecido no exterior: a competência é apurada por sucessor (LC 227/2026; CF art. 155 §1º).
- **Tabelas por UF:**
  - `situacaoTabela` por UF: PESQUISADA, DIVERGENCIA_CONHECIDA, FAIXAS_ESTIMADAS ou REFERENCIA;
  - vigência conferida contra a data do fato gerador;
  - abatimento de dívidas por UF (SP não abate; nas demais, "controvertido");
  - **nenhuma alíquota foi alterada sem fonte.**
- **Centavos:** rateio pelo maior resto e fração como razão; ordem canônica por id, para o resultado não depender da ordem de entrada.
- **Legados:**
  - legado de bem certo é tributado na UF do bem;
  - legado de bem comum fica limitado à parte do testador (art. 1.914).
- **Saídas novas:**
  - avisos estruturados (`avisos[]` com gravidade) e `minuta.exigeConfirmacao`;
  - `atribuicoes`, `montes`, `testamento`, `visao` (base de avaliação e filtro da partilha oficial);
  - `montarConjugeDaEntrada`;
  - `hashDoResultado` (sha256 puro, roda em Node e no navegador).
- **Caracterização:** contra os dois motores antigos, congelados em `src/__tests__/caracterizacao/legado/`. Os vetores dourados foram regenerados.

## 2. Armadilhas

1. **O `dist/` é versionado** e os apps o consomem por git-dependency. Toda mudança no `src/` exige `npm run build` e o commit do `dist/` junto. O `cloud-setup.sh` falha se os dois divergirem.
2. **Publicação:** primeiro esta branch vai para a `main` daqui, por PR. Só depois os apps atualizam o `package-lock.json` para o novo SHA. Antes disso, os apps usam a branch só no `node_modules`, pelo `cloud-setup.sh` deles.
3. **Homologação de alíquota** (`conferidaPor`/`conferidaEm` em `homologacao.ts`) é a assinatura de um advogado humano: nunca preencha. Alíquota só muda com fonte primária registrada.
4. **Padrão de defeito a evitar:** número plausível sem o aviso que o acompanha. Onde a lei deixa dúvida, o resultado traz aviso estruturado e, se for o caso, trava a minuta.

## 3. Pontos para um advogado conferir

- RN como "divergência conhecida", com base só em fonte secundária.
- Base por quinhão em todas as UFs. Conferir:
  - a redação de PB ("valores totais dos bens");
  - GO e RJ;
  - o método de AL;
  - AC na sobrepartilha.
- AL e PB: só a data da lei está registrada como início de vigência; falta a data de efeitos.
- Abatimento de dívidas nas 26 UFs "controvertidas"; ITCD em herança insolvente.
- Colação na quota testamentária (art. 2.002, parágrafo único).
- Redução de legado indivisível (art. 1.968).
- Excesso de quinhão sem torna: hoje é tratado como doação (ITCD), e não como torna paga (ITBI).

## 4. Como testar

```bash
bash scripts/cloud-setup.sh   # npm ci, typecheck (+ golden), vitest, build e checagem do dist/
npm run golden:gerar          # regenera os vetores dourados (explique cada vetor que mudar)
```

Em 19/11 passaram 611 testes, os dois typechecks estavam limpos e o `dist/` estava idêntico ao build.

## 5. Variáveis de ambiente

Nenhuma.
