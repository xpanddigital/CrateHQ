# DEP0169 url.parse() warning in Vercel logs

If you see this in Vercel (or local) logs:

```
DeprecationWarning: `url.parse()` behavior is not standardized...
Use the WHATWG URL API instead.
```

**Cause:** Next.js (and sometimes other dependencies) still use Node’s legacy `url.parse()` in a few places. Node 22+ emits this deprecation. It does **not** break the app; it’s only a warning.

**What we did:**
- Upgraded Next.js to the latest 14.2.x so fewer (or no) code paths use `url.parse()`.

**If the warning still appears** and you want to hide it in Vercel:

1. Open your project on [Vercel](https://vercel.com) → **Settings** → **Environment Variables**.
2. Add:
   - **Name:** `NODE_OPTIONS`
   - **Value:** `--disable-warning=DEP0169`
   - **Environment:** Production (and Preview if you want).
3. Redeploy.

This only works on **Node 22+**. If your Vercel runtime is Node 18/20, the flag may be ignored; the warning is harmless either way.
