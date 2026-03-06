# DEP0169 url.parse() warning in Vercel logs

If you see this in Vercel (or local) logs:

```
DeprecationWarning: `url.parse()` behavior is not standardized...
Use the WHATWG URL API instead.
```

**Cause:** Next.js (and sometimes other dependencies) still use Node's legacy `url.parse()` in a few places. Node 22+ emits this deprecation. It does **not** break the app; it's only a warning.

**What we did:**
- **suppress-dep0169.cjs** at project root — available for local/self-hosted use with `NODE_OPTIONS='--require=./suppress-dep0169.cjs'` if you run `npm start` manually.
- **src/instrumentation.ts** — patches at load time to suppress DEP0169 when the server runs.

**Vercel:** Do **not** set `NODE_OPTIONS` in Vercel. It is applied to the build as well as runtime; during build the working directory can differ, so `--require=./suppress-dep0169.cjs` causes "Cannot find module" and the build fails. Remove `NODE_OPTIONS` from your Vercel env vars so the build succeeds. Rely on `instrumentation.ts` only. The DEP0169 message is harmless and does not affect behavior.
