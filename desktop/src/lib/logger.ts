/**
 * logger.ts — Renderer-process logger.
 *
 * Sends log messages to the Electron main process via IPC so they are
 * written to the rotating spdlog file alongside main-process logs.
 * In development the same message is also printed to the DevTools console.
 */

type LogLevel = 'info' | 'warn' | 'error' | 'debug'

function send(level: LogLevel, message: string): void {
  if (import.meta.env.DEV) {
    console[level](`[renderer] ${message}`)
  }
  // electronAPI is injected by the preload script via contextBridge.
  // The optional chain guards against the rare case where the preload
  // hasn't finished initialising (e.g. very first frame).
  ;(window as Window & { electronAPI?: { log?: (level: string, msg: string) => void } })
    .electronAPI?.log?.(level, message)
}

export const log = {
  info:  (msg: string) => send('info', msg),
  warn:  (msg: string) => send('warn', msg),
  error: (msg: string) => send('error', msg),
  debug: (msg: string) => send('debug', msg),
}
