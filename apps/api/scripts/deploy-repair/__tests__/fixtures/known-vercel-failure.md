# Vercel build log excerpt — known failure class

Source: a realistic excerpt matching the "useSearchParams without Suspense"
build-failure class documented in `memory-bank/memory.md`'s "Vercel /
Next.js Build Fixes" section (lesson 5). Used by
`apps/api/scripts/deploy-repair/__tests__/replay.test.ts` (SC2) to prove the
diagnosis-input path end to end against a real, quotable Next.js build
error — not a paraphrase.

```
Running "npm run build:web"

> @agency-platform/web@0.1.0 build
> next build

  ▲ Next.js 16.0.1
  - Environments: .env.production

   Creating an optimized production build ...
 ✓ Compiled successfully
   Linting and checking validity of types ...
 ✓ Linting and checking validity of types
   Collecting page data ...
   Generating static pages (0/48) ...
Error occurred prerendering page "/checkout/success". Read more: https://nextjs.org/docs/messages/prerender-error
Error: useSearchParams() should be wrapped in a suspense boundary at page "/checkout/success". Read more: https://nextjs.org/docs/messages/missing-suspense-with-csr-bailout
    at u (/vercel/path0/apps/web/.next/server/chunks/4567.js:1:3421)
    at renderToReadableStream (/vercel/path0/node_modules/react-dom/cjs/react-dom-server.edge.production.js:2:105)
    at exportPages (/vercel/path0/node_modules/next/dist/export/worker.js:214:22)
Export encountered an error on /checkout/success/page: /checkout/success, exiting the build.
 ⨯ Next.js build worker exited with code: 1 and signal: null
Error: Command "npm run build:web" exited with 1
```
