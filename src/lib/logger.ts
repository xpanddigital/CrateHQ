/**
 * Structured logger for server-side code.
 *
 * - In production: outputs JSON lines for Vercel log parsing
 * - In development: outputs human-readable prefixed lines
 * - Respects LOG_LEVEL env var (debug | info | warn | error)
 * - Drop-in replacement for console.log/error/warn — accepts variadic args
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error'

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
}

const currentLevel: LogLevel =
  (process.env.LOG_LEVEL as LogLevel) ||
  (process.env.NODE_ENV === 'production' ? 'info' : 'debug')

const isProd = process.env.NODE_ENV === 'production'

function serialize(value: unknown): unknown {
  if (value instanceof Error) {
    return { name: value.name, message: value.message, stack: value.stack }
  }
  return value
}

function log(level: LogLevel, args: unknown[]) {
  if (LOG_LEVELS[level] < LOG_LEVELS[currentLevel]) return

  const message = typeof args[0] === 'string' ? args[0] : ''
  const rest = typeof args[0] === 'string' ? args.slice(1) : args

  if (isProd) {
    const entry: Record<string, unknown> = {
      level,
      msg: message,
      ts: Date.now(),
    }
    if (rest.length === 1) {
      entry.data = serialize(rest[0])
    } else if (rest.length > 1) {
      entry.data = rest.map(serialize)
    }
    // Use appropriate console method so Vercel classifies severity correctly
    const method = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log
    method(JSON.stringify(entry))
  } else {
    const prefix = `[${level.toUpperCase()}]`
    const method =
      level === 'error' ? console.error :
      level === 'warn' ? console.warn :
      level === 'debug' ? console.debug :
      console.log
    method(prefix, ...args)
  }
}

export const logger = {
  debug: (...args: unknown[]) => log('debug', args),
  info: (...args: unknown[]) => log('info', args),
  warn: (...args: unknown[]) => log('warn', args),
  error: (...args: unknown[]) => log('error', args),
}
