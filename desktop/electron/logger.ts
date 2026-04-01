/**
 * logger.ts — Main-process logger backed by @vscode/spdlog (rotating file).
 *
 * Call initLogger() once inside app.whenReady() before anything else.
 * Until then every log call silently falls back to console so very-early
 * startup messages are not lost.
 */

import * as spdlog from '@vscode/spdlog'
import { app } from 'electron'
import path from 'path'

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10 MB
const MAX_FILES = 5

type SpdLogger = Awaited<ReturnType<typeof spdlog.createRotatingLogger>>

let _logger: SpdLogger | null = null

export async function initLogger(): Promise<void> {
  const logPath = '/tmp/locktime_fe.log'

  _logger = await spdlog.createRotatingLogger('locktime', logPath, MAX_FILE_SIZE, MAX_FILES)
  _logger.setLevel(2) // info
  _logger.setPattern('[%Y-%m-%d %H:%M:%S] [%l] %v')
  _logger.info(`logger initialized — writing to ${logPath}`)
}

function write(level: 'info' | 'warn' | 'error' | 'debug', msg: string): void {
  if (_logger) {
    _logger[level](msg)
  } else {
    // Pre-init fallback so we never silently swallow startup messages.
    console[level](`[locktime] ${msg}`)
  }
}

export const log = {
  info:  (msg: string) => write('info', msg),
  warn:  (msg: string) => write('warn', msg),
  error: (msg: string) => write('error', msg),
  debug: (msg: string) => write('debug', msg),
  flush: () => _logger?.flush(),
}
