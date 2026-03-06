/**
 * Loaded via NODE_OPTIONS=--require=./suppress-dep0169.cjs before Next.js starts.
 * Suppresses Node's DEP0169 (url.parse) deprecation so it doesn't clutter Vercel logs.
 */
const origEmit = process.emit;
if (typeof origEmit === 'function') {
  process.emit = function (name, ...args) {
    if (name === 'warning' && args[0] && typeof args[0] === 'object') {
      const w = args[0];
      if (w.code === 'DEP0169' || (w.message && String(w.message).includes('url.parse()'))) {
        return true;
      }
    }
    return origEmit.apply(this, [name, ...args]);
  };
}
