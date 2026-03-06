/**
 * Runs once when the Next.js server starts. Suppresses Node DEP0169 (url.parse)
 * so Vercel logs aren't filled with deprecation warnings from Next/deps.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return

  const origEmit = process.emit
  if (typeof origEmit !== 'function') return

  process.emit = function (this: NodeJS.Process, name: string, ...args: unknown[]) {
    if (name === 'warning' && args[0] && typeof args[0] === 'object' && (args[0] as NodeJS.EmitWarningOptions).code === 'DEP0169') {
      return true
    }
    return origEmit.apply(this, [name, ...args])
  } as NodeJS.Process['emit']
}
