/**
 * Suppress DEP0169 (url.parse) at module load so it runs before register().
 * Next/deps emit this during request handling; patch must be in place by then.
 */
function suppressDep0169() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return
  const origEmit = process.emit
  if (typeof origEmit !== 'function') return
  process.emit = function (this: NodeJS.Process, name: string, ...args: unknown[]) {
    if (name === 'warning' && args[0] && typeof args[0] === 'object') {
      const w = args[0] as { code?: string; message?: string }
      if (w.code === 'DEP0169' || (w.message && String(w.message).includes('url.parse()'))) return true
    }
    return (origEmit as (...a: unknown[]) => boolean).apply(this, [name, ...args])
  } as NodeJS.Process['emit']
}
suppressDep0169()

export async function register() {
  // Optional: run again in case this module loaded after first warning
  suppressDep0169()
}
