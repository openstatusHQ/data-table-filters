# CLAUDE.md

## Project overview

**data-table-filters** — a React data table system with faceted filters, sorting, infinite scroll, and virtualization. Delivered as shadcn registry blocks installable via `npx shadcn@latest add`.

### Monorepo structure (pnpm + turborepo)

- `apps/web` — Next.js app (docs site + demo). Uses App Router.
- `packages/registry` — the shadcn registry source (components, utilities, Drizzle helpers)
- `packages/tsconfig` — shared TS configs

### Key commands

```bash
pnpm dev              # start all workspaces
pnpm build            # turbo build (includes registry:build)
pnpm lint             # turbo lint (eslint across workspaces)
pnpm turbo typecheck  # tsc --noEmit across workspaces
pnpm test             # turbo test (vitest across workspaces)
pnpm format           # prettier --write .
pnpm registry:build   # build shadcn registry artifacts
```

### Database

- Drizzle ORM with Postgres (Supabase)
- DB-dependent tests run in CI only (Postgres service container in GitHub Actions)
- Tests use `describe.skipIf(!hasDatabase)` — they skip gracefully without `DATABASE_URL`
- Migrations: `pnpm --filter web db:drizzle:migrate`
- Seed test data: `pnpm --filter web db:drizzle:seed-test`

## Coding standards

### Before every commit, run local checks

The pre-commit hook (`.claude/hooks/pre-commit-checks.sh`) runs automatically before `git commit`. It enforces:

1. `pnpm prettier --check .` — format check (fix with `pnpm format` if needed)
2. `pnpm turbo lint` — eslint
3. `pnpm turbo typecheck` — tsc --noEmit
4. `DATABASE_URL= pnpm turbo test` — vitest (non-DB tests only)

If any step fails, fix it before committing. Do not use `--no-verify` or skip hooks.

### After pushing, verify CI

DB-dependent tests (Drizzle integration tests) only run in GitHub Actions CI where Postgres is available. After pushing a branch or opening a PR, check CI status with `gh run list` or `gh pr checks`. If DB tests fail in CI, fix locally and push again.

### Testing policy

- **Testing is very important.** Every utility function, helper, and non-trivial logic must have tests.
- When creating or modifying utility functions, always write or update corresponding tests.
- When fixing a bug, add a regression test that covers the fix.
- Use vitest. Tests live alongside source files or in `__tests__/` directories.
- Registry tests (Drizzle helpers): `packages/registry/src/lib/drizzle/__tests__/`
- Web tests: `apps/web/src/` (colocated)

### Code style

- TypeScript strict mode. No `any` unless absolutely necessary (and document why).
- Use server components by default in Next.js — only add `"use client"` when needed.
- Follow existing patterns in the codebase. Read surrounding code before making changes.
- No unnecessary abstractions — keep it simple.
- Prettier handles formatting (import sorting via `@ianvs/prettier-plugin-sort-imports`, Tailwind class sorting via `prettier-plugin-tailwindcss`).

## Git workflow

### Branching

Always create feature/fix branches from `main`:

```bash
git checkout main && git pull origin main
git checkout -b <type>/<short-description>
```

Branch naming: `feat/`, `fix/`, `refactor/`, `chore/`, `docs/` — matching the commit type.

### Conventional commits

Use [Conventional Commits](https://www.conventionalcommits.org/). Match the existing style in this repo:

```
feat: add column pinning support
fix: slider filter range validation
refactor: extract shared filter logic
chore: update dependencies
docs: add drizzle integration guide
test: add facet computation edge cases
```

- Keep the subject line short (<70 chars), lowercase, no period
- Use the body for details when needed
- Scope is optional: `fix(registry): ...` or `feat(web): ...`

### CI verification

After pushing, verify CI passes: `gh run list --branch <branch>` or `gh pr checks`.
To trigger CI manually on any branch: `gh workflow run ci.yml --ref <branch>`.

## Workflow expectations

- **Ask clarifying questions** before starting ambiguous tasks. Don't guess intent.
- **Read code before modifying it.** Understand the existing patterns.
- **Always branch from `main`** for new work. Never commit directly to `main`.
- **Run CI checks before committing.** No exceptions.
- **Test your changes.** If you write logic, write tests. If you change logic, update tests.
- **Check if registry needs rebuilding** after modifying anything in `packages/registry/src/`.
- **Verify CI after pushing.** DB integration tests only run in GitHub Actions.
