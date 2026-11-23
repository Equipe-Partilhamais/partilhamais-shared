# Prompt de retomada (cole numa sessão do Claude Code na nuvem com o repositório `partilhamais-shared`)

```
Responda sempre em português. Você vai continuar o trabalho no motor de cálculo do
PartilhaMais, no repositório partilhamais-shared (público), branch fix/auditoria-2026-11.

1. Faça checkout da branch fix/auditoria-2026-11 e leia HANDOFF.md, CLAUDE.md e README.md.
2. Rode: bash scripts/cloud-setup.sh — instala e roda typecheck, testes, build e a checagem
   de que o dist/ versionado bate com o src/. Me diga o resultado.
3. Regras: nunca altere alíquota sem fonte primária registrada; nunca preencha a homologação
   (é assinatura de advogado); toda mudança no src/ vai junto com o dist/ gerado; nada de
   detalhe de segurança neste repositório (ele é público); nunca faça push na main sem eu pedir.
4. Depois me pergunte em que vamos trabalhar.
```
