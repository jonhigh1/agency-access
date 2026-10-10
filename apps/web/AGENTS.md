<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# QueryClient / AppProviders (web)

After the March 2026 provider split, `QueryClientProvider` lives in route-level `AppProviders` (`src/app/app-providers.tsx`), not the root layout. Authenticated, onboarding, platforms, partners, test, and invite layouts wrap it.

## When adding React Query under `src/app/**`

- An ancestor `layout.tsx` must wrap `AppProviders`, or the page must mount its own `QueryClientProvider` (visual-qa only today).
- Static gate: `scripts/tests/app-query-provider-walker.test.mjs` (in root `test:run`).

## Page tests and hook mocks

- Do **not** mock `@/hooks/use-user-agency` or React Query hooks as a substitute for the layout provider contract. That is how #155 shipped `useUserAgency` on `/invite` while CI stayed green.
- Provider contract: `src/app/invite/[token]/__tests__/provider-boundary.test.tsx` (and the walker). Keep those greens.
- When a test needs controlled agency data, mock one layer down: `authorizedApiFetch`, Clerk/`useAuth`, or network — not the provider-bound hook.
