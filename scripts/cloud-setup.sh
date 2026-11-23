#!/usr/bin/env bash
# Setup do ambiente de nuvem do Claude Code (claude.ai/code) para o partilhamais-shared.
#
# Ambiente esperado: Ubuntu 24.04, Node 20/21/22 já instalados. Idempotente.
#
# Uso (na raiz do repositório):
#   bash scripts/cloud-setup.sh                 # instala e roda typecheck, testes e build
#   RODAR_TESTES=0 bash scripts/cloud-setup.sh  # só instala
set -euo pipefail

cd "$(dirname "$0")/.."
RODAR_TESTES="${RODAR_TESTES:-1}"

log() { printf '\n==> %s\n' "$*"; }
falha() { printf '\nERRO: %s\n' "$*" >&2; exit 1; }

log "Node"
command -v node >/dev/null 2>&1 || falha "Node não encontrado."
node -e 'process.exit(Number(process.versions.node.split(".")[0])>=20?0:1)' \
  || falha "preciso de Node >= 20 (tenho $(node -v))."
node -v && npm -v

log "Dependências (npm ci)"
if [ ! -f node_modules/.package-lock.json ] || [ package-lock.json -nt node_modules/.package-lock.json ]; then
  npm ci --no-audit --no-fund
else
  echo "node_modules já está em dia com o package-lock.json."
fi

if [ "$RODAR_TESTES" = "1" ]; then
  log "Typecheck"
  npm run typecheck
  npm run typecheck:golden
  log "Testes (vitest)"
  npm test
  log "Build (o dist/ é versionado e tem de bater com o src/)"
  npm run build
  if ! git diff --quiet -- dist; then
    git --no-pager diff --stat -- dist
    falha "o dist/ versionado não bate com o src/. Comite o dist/ gerado junto com a mudança."
  fi
fi

log "Pronto. Leia HANDOFF.md antes de mexer."
