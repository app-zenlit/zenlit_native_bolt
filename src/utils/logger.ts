type Level = 'error' | 'warn' | 'info' | 'debug'

const order: Record<Level, number> = { error: 0, warn: 1, info: 2, debug: 3 }

const envLevel = (typeof process !== 'undefined' && process.env && process.env.EXPO_PUBLIC_LOG_LEVEL) || ''
const defaultLevel: Level = __DEV__ ? 'info' : 'error'
let threshold: Level = (['error', 'warn', 'info', 'debug'] as Level[]).includes(envLevel as Level)
  ? (envLevel as Level)
  : defaultLevel

const windowMs = Number((typeof process !== 'undefined' && process.env && process.env.EXPO_PUBLIC_LOG_DUPLICATE_WINDOW_MS) || 1000)
const maxRepeats = Number((typeof process !== 'undefined' && process.env && process.env.EXPO_PUBLIC_LOG_DUPLICATE_MAX) || 3)

const recent = new Map<string, { t: number; c: number }>()

function shouldPrint(level: Level, key: string): boolean {
  if (order[level] > order[threshold]) return false
  const now = Date.now()
  const r = recent.get(key)
  if (!r || now - r.t > windowMs) {
    recent.set(key, { t: now, c: 1 })
    return true
  }
  if (r.c >= maxRepeats) return false
  r.c += 1
  return true
}

function write(level: Level, tag: string, message: string, ...args: any[]) {
  const key = `${level}:${tag}:${message}`
  if (!shouldPrint(level, key)) return
  const prefix = `[${tag}] ${message}`
  if (level === 'error') console.error(prefix, ...args)
  else if (level === 'warn') console.warn(prefix, ...args)
  else console.log(prefix, ...args)
}

export const logger = {
  setLevel(l: Level) {
    threshold = l
  },
  error(tag: string, message: string, ...args: any[]) {
    write('error', tag, message, ...args)
  },
  warn(tag: string, message: string, ...args: any[]) {
    write('warn', tag, message, ...args)
  },
  info(tag: string, message: string, ...args: any[]) {
    write('info', tag, message, ...args)
  },
  debug(tag: string, message: string, ...args: any[]) {
    write('debug', tag, message, ...args)
  },
}

