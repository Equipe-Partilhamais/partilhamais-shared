# PartilhaMais — Guia da Stack e do Fluxo de Trabalho

> Este arquivo (CLAUDE.md ≡ AGENTS.md) descreve **todo o sistema** e a **rota de
> desenvolvimento**. Vale para os 4 repositórios do projeto.

## 1. O que é

SaaS jurídico-financeiro para **partilha de herança** e **cálculo de ITCD**
(imposto de transmissão) voltado a advogados. Manipula CPF, patrimônio e cálculo
de tributo — **correção de cálculo e segurança são críticos**.

## 2. Repositórios (arquitetura polyrepo)

| Repo | Papel | Stack |
|---|---|---|
| **partilhamais-shared** (público) | Engine de cálculo **canônico** (ITCD por UF, honorários, unidades fiscais). Fonte ÚNICA usada por back e front — evita divergência de cálculo. | TypeScript, publicado como git-dependency `@partilhamais/shared` |
| **partilhamais-backend** (privado) | API | Next.js 16 (App Router), Prisma 7 + PostgreSQL, JWT próprio, Stripe, Redis (ioredis) |
| **partilhamais-frontend** (privado) | SPA | Vite + React, Zustand, TailwindCSS |
| **partilhamais-ocr** (privado) | Microserviço de OCR de documentos | Python, FastAPI, PaddleOCR |

> ⚠️ **Nunca duplique** a lógica de cálculo nos apps. Ela mora **só** em
> `@partilhamais/shared`. Alterou o cálculo? Faça no shared, rode `npm run build`,
> commite o `dist/` e suba — os apps puxam via git-dependency (`#main`).

## 3. Infraestrutura (100% OCI free-tier)

- **1 VM Ampere A1** (Ubuntu 24.04 ARM, 4 OCPU/24GB) roda tudo em Docker.
- **Postgres** self-hosted (interno) · **Redis** self-hosted (cache + rate-limit) ·
  **MinIO/R2** para arquivos (substitui Cloudinary) · **Caddy** (proxy + TLS).
- **GlitchTip** (compatível com Sentry) em `logs.partilhamais.com.br` — erros/logs.
- **Cloudflare** — DNS + TLS + Access (protege o `dev`).

### Ambientes
| Ambiente | URL | Branch | Deploy |
|---|---|---|---|
| **Produção** | `partilhamais.com.br` / `api.` | `main` | automático (CI) |
| **Dev** | `dev.partilhamais.com.br` | `develop` | automático (CI) |
| **Logs** | `logs.partilhamais.com.br` | — | GlitchTip |

## 4. Como funciona (fluxo do sistema)

1. **Auth**: JWT (access 2h) + refresh token em cookie httpOnly; rate-limit por IP
   confiável (CF-Connecting-IP) + Redis.
2. **Inventário**: usuário cadastra falecido, herdeiros, bens e passivos.
3. **Cálculo**: `@partilhamais/shared` calcula partilha, ITCD por estado e
   honorários — **mesmo resultado** no backend (petições/escrituras) e no frontend.
4. **OCR**: documentos são enviados ao serviço Python (PaddleOCR) que extrai dados.
5. **Storage**: arquivos vão para object storage S3-compatível (MinIO/R2).
6. **Billing**: Stripe (allowlist de preços; webhook idempotente).

## 5. 🔄 Rota de trabalho de desenvolvimento

```
implementação/correção (branch de feature)
        │  git push
        ▼
   origin/develop  ──► CI: testes + deploy automático no DEV
        │
        ▼
   testar em dev.partilhamais.com.br
        │
        ▼
   validação de QA  ✅
        │
        ▼
   abrir PR: develop → main  (proteção de branch: reviews + checks verdes)
        │
        ▼
   aprovação + merge
        │
        ▼
   origin/main  ──► CI: deploy automático em PRODUÇÃO
```

### Regras práticas
- **Nunca commite direto na `main`** — só via PR aprovado.
- Todo PR precisa: **CI verde** (testes back+front) + **≥1 review aprovado**.
- Mudança de cálculo → PR no `partilhamais-shared` primeiro; depois os apps
  atualizam a referência do git-dependency.
- Segredos ficam só em `.env*` no servidor (nunca no git). Rotacione se vazarem.

## 6. Comandos úteis

**Backend** (`partilhamais-backend/`)
```
npm install            # inclui @partilhamais/shared (git-dep)
npx prisma generate
npm run dev            # :3001
npm test               # jest
```
**Frontend** (`partilhamais-frontend/`)
```
npm install
npm run dev            # vite
npm test               # vitest
npm run e2e            # playwright
```
**Shared** (`partilhamais-shared/`)
```
npm run build          # tsc -> dist/ (commitar o dist após alterar)
```
**OCR** (`partilhamais-ocr/`)
```
uvicorn app.main:app --port 8000
```

## 7. Variáveis de ambiente principais (backend)
`DATABASE_URL`, `JWT_SECRET`, `REFRESH_SECRET`, `REDIS_URL`, `OCR_SERVICE_URL`,
`SENTRY_DSN` (GlitchTip), `TRUST_CLOUDFLARE=true`, `STRIPE_SECRET_KEY` + `STRIPE_PRICE_*`,
`ALLOW_OWNER_EMAIL_BOOTSTRAP` (deixar ausente em prod).

## 8. Qualidade / segurança
- Auditoria pré-produção e correções: ver `docs/` (no histórico do monorepo original).
- Cálculo (dinheiro/imposto) e segurança (LGPD, CPF) são os eixos críticos —
  qualquer mudança neles exige testes de regressão.
