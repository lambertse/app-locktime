import {
  app,
  BrowserWindow,
  Tray,
  Menu,
  nativeImage,
  ipcMain,
  session,
  dialog,
} from 'electron'

Menu.setApplicationMenu(null)

import path from 'path'
import { execFile } from 'child_process'
import { LockTimeRPCClient, RPC_ENDPOINT } from './locktime-rpc'
import type {
  CreateRuleRequest,
  UpdateRuleRequest,
  PatchRuleRequest,
  GrantOverrideRequest,
  GetBlockAttemptsRequest,
} from './locktime-rpc'

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged

let mainWindow: BrowserWindow | null = null
let tray: Tray | null = null
let isQuitting = false

// ─── RPC Client ──────────────────────────────────────────────────────────────
const rpc = new LockTimeRPCClient(RPC_ENDPOINT)
// ─── Service Management ──────────────────────────────────────────────────────

const SERVICE_NAME = 'AppLockerSvc'

function getServiceExePath(): string {
  if (isDev) return ''
  return path.join(process.resourcesPath, 'bin', 'locktime-svc.exe')
}

function isServiceRunning(): Promise<boolean> {
  return new Promise((resolve) => {
    if (process.platform !== 'win32') {
      resolve(false)
      return
    }
    execFile('sc', ['query', SERVICE_NAME], (err, stdout) => {
      resolve(!err && stdout.includes('RUNNING'))
    })
  })
}

async function ensureServiceRunning(): Promise<void> {
  if (isDev || process.platform !== 'win32') return

  const running = await isServiceRunning()
  if (!running) {
    const svcPath = getServiceExePath()
    if (svcPath) {
      await new Promise<void>((resolve) => {
        execFile('sc', ['start', SERVICE_NAME], () => resolve())
      })
    }
  }

  // Wait for the RPC server to become reachable (replaces HTTP polling)
  for (let i = 0; i < 20; i++) {
    try {
      await rpc.connect()
      console.log('[LockTime] RPC server is up')
      return
    } catch {
      await new Promise((r) => setTimeout(r, 500))
    }
  }
  console.warn('[LockTime] RPC server did not respond in time')
}

// ─── Single Instance ─────────────────────────────────────────────────────────

const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
  process.exit(0)
}

app.on('second-instance', () => {
  if (mainWindow) {
    if (!mainWindow.isVisible()) mainWindow.show()
    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.focus()
  }
})

// ─── Tray ────────────────────────────────────────────────────────────────────

function createTray(): void {
  const iconPath = isDev
    ? path.join(__dirname, '..', 'public', 'icons', 'icon.ico')
    : path.join(process.resourcesPath, 'icons', 'icon.ico')

  let trayIcon = nativeImage.createEmpty()
  try {
    trayIcon = nativeImage.createFromPath(iconPath)
  } catch {
    // icon not found in dev — tray uses empty icon
  }

  tray = new Tray(trayIcon)
  tray.setToolTip('AppLocker')

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Show',
      click: () => {
        if (mainWindow) { mainWindow.show(); mainWindow.focus() }
      },
    },
    { label: 'Hide', click: () => mainWindow?.hide() },
    { type: 'separator' },
    { label: 'Quit', click: () => app.quit() },
  ])

  tray.setContextMenu(contextMenu)
  tray.on('click', () => {
    if (mainWindow) {
      mainWindow.isVisible() ? mainWindow.focus() : mainWindow.show()
    }
  })
}

// ─── Window ──────────────────────────────────────────────────────────────────

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    resizable: false,
    maximizable: false,
    fullscreenable: false,
    show: false,
    title: 'AppLocker',
    autoHideMenuBar: true,
    titleBarStyle: process.platform === 'darwin' ? 'hidden' : 'default',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  })

  // Tighten CSP — no more HTTP 8089 origin needed
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          "default-src 'self'; " +
            "script-src 'self'; " +
            "style-src 'self' 'unsafe-inline'; " +
            "connect-src 'self'; " +
            "img-src 'self' data:; " +
            "font-src 'self' data:;",
        ],
      },
    })
  })

  mainWindow.once('ready-to-show', () => mainWindow?.show())

  mainWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault()
      mainWindow?.hide()
    }
  })

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173')
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'))
  }
}

// ─── IPC — Window Controls ───────────────────────────────────────────────────

ipcMain.on('window:minimize', () => mainWindow?.minimize())
ipcMain.on('window:hide',     () => mainWindow?.hide())
ipcMain.on('window:quit',     () => app.quit())

// ─── IPC — RPC Bridge ────────────────────────────────────────────────────────
// Each handler calls the C++ backend via iBridger and returns the result to the
// renderer. Errors are returned as { __error: message } so the renderer can
// throw them back to the caller.

function rpcHandler<T>(fn: () => Promise<T>) {
  return async (): Promise<T | { __error: string }> => {
    try {
      // Reconnect if the client dropped (e.g. service restarted)
      if (!rpc.isConnected) await rpc.connect()
      return await fn()
    } catch (err) {
      console.error('[RPC]', err)
      return { __error: err instanceof Error ? err.message : String(err) }
    }
  }
}

// Status
ipcMain.handle('api:getStatus', rpcHandler(() => rpc.getStatus()))

// Rules
ipcMain.handle('api:listRules', rpcHandler(() => rpc.listRules()))
ipcMain.handle('api:getRule',   (_e, id: string) => rpcHandler(() => rpc.getRule(id))())
ipcMain.handle('api:createRule', (_e, req: CreateRuleRequest) =>
  rpcHandler(() => rpc.createRule(req))())
ipcMain.handle('api:updateRule', (_e, req: UpdateRuleRequest) =>
  rpcHandler(() => rpc.updateRule(req))())
ipcMain.handle('api:patchRule', (_e, req: PatchRuleRequest) =>
  rpcHandler(() => rpc.patchRule(req))())
ipcMain.handle('api:deleteRule', (_e, id: string) =>
  rpcHandler(() => rpc.deleteRule(id))())

// Overrides
ipcMain.handle('api:grantOverride', (_e, req: GrantOverrideRequest) =>
  rpcHandler(() => rpc.grantOverride(req))())
ipcMain.handle('api:revokeOverride', (_e, ruleId: string) =>
  rpcHandler(() => rpc.revokeOverride(ruleId))())

// Usage
ipcMain.handle('api:getUsageToday', rpcHandler(() => rpc.getUsageToday()))
ipcMain.handle('api:getUsageWeek',  rpcHandler(() => rpc.getUsageWeek()))
ipcMain.handle('api:getBlockAttempts', (_e, req: GetBlockAttemptsRequest = {}) =>
  rpcHandler(() => rpc.getBlockAttempts(req))())

// System
ipcMain.handle('api:getProcesses', rpcHandler(() => rpc.getProcesses()))

// Browse file — handled entirely by Electron (no C++ needed)
ipcMain.handle('api:browseFile', async () => {
  const result = await dialog.showOpenDialog(mainWindow!, {
    title: 'Select Executable',
    filters: [
      { name: 'Executables', extensions: ['exe'] },
      { name: 'All Files', extensions: ['*'] },
    ],
    properties: ['openFile'],
  })
  return {
    path: result.canceled ? null : result.filePaths[0] ?? null,
    cancelled: result.canceled,
  }
})

// Config
ipcMain.handle('api:getConfig', rpcHandler(() => rpc.getConfig()))
ipcMain.handle('api:updateConfig', (_e, config: Record<string, string>) =>
  rpcHandler(() => rpc.updateConfig(config))())

// ─── App Lifecycle ────────────────────────────────────────────────────────────

app.whenReady().then(async () => {
  app.setName('AppLocker')
  app.setLoginItemSettings({ openAtLogin: false, name: 'AppLocker' })

  await ensureServiceRunning()

  createWindow()
  createTray()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    } else {
      mainWindow?.show()
    }
  })
})

app.on('before-quit', () => {
  isQuitting = true
  rpc.disconnect()
})

app.on('window-all-closed', () => {
  // Stay in tray — do not quit
})
