# DEP0169 url.parse() warning in Vercel logs

If you see this in Vercel (or local) logs:

```
DeprecationWarning: `url.parse()` behavior is not standardized...
Use the WHATWG URL API instead.
```

**Cause:** Next.js (and sometimes other dependencies) still use Node’s legacy `url.parse()` in a few places. Node 22+ emits this deprecation. It does **not** break the app; it’s only a warning.

**What we did:**
- **suppress-dep0169.cjs** at project root — patches `process.emit` so DEP0169 is not printed.
- **package.json** `start` script uses `NODE_OPTIONS='--require=./suppress-dep0169.cjs'` so the patch loads before Next.js (when you run `npm start`).
- **src/instrumentation.ts** — also patches at load time as a fallback.

**Vercel (serverless):** Workers often don’t use the start script. To silence the warning on Vercel:

1. [Vercel](https://vercel.com) → your project → **Settings** → **Environment Variables**.
2. Add:
   - **Name:** `NODE_OPTIONS`
   - **Value:** `--require=./suppress-dep0169.cjs`
   - **Environments:** Production (and Preview if you want).
3. **Redeploy** so new invocations use the variable.

The file `suppress-dep0169.cjs` is in the repo and deployed; the path is correct. On **Node 22+** you can instead use **Value:** `--disable-warning=DEP0169` (no file).
