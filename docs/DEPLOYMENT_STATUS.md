# Vercel Deployment Status

> **History — not current.** Vercel blocker notes. Live host is Render per `render.yaml`; verify before deploy work.

## Current Issue

Vercel is failing during the `npm install` step because:
- Root Directory is set to `apps/web` in Vercel dashboard
- When rootDirectory is set, Vercel automatically runs `npm install` from that directory
- `apps/web` doesn't have a root `package.json` with workspaces, so install fails

## Solution

**You need to unset the Root Directory in Vercel dashboard:**

1. Go to https://vercel.com/jon-highs-projects/web/settings/general
2. Find "Root Directory" setting
3. **Clear/remove** the `apps/web` value (set it to empty or ".")
4. Save settings

Then the `vercel.json` configuration will work correctly, as it's designed to run from the repository root.

## Alternative: Keep rootDirectory but fix install

If you prefer to keep rootDirectory set, we need to ensure `apps/web` has access to the root package.json. This is more complex and not recommended.

## Current Configuration

The `vercel.json` is configured to:
- Use `vercel-build.sh` script that navigates to repo root
- Install dependencies from root
- Build shared package and web app
- Output to `apps/web/.next`

This will work once rootDirectory is unset in the dashboard.

