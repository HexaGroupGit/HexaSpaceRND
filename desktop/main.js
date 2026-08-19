// Hexa Space Admin — desktop shell.
//
// Deliberately a thin window around the live portal rather than a bundled copy
// of the app: staff get a dock/taskbar icon, their own window and a real print
// and download experience, while the portal itself keeps updating on every
// Vercel deploy. The installer only needs re-issuing when this shell changes,
// not when the admin app does.
//
// PORTAL_URL can be overridden at runtime (PORTAL_URL=http://localhost:5173
// npm start) to point the shell at a local dev server.
const { app, BrowserWindow, Menu, shell, dialog, session } = require('electron')
const path = require('node:path')
const fs = require('node:fs')

const PORTAL_URL = process.env.PORTAL_URL || 'https://portal.hexaspace.com.au'
const PORTAL_HOST = new URL(PORTAL_URL).host
const BRAND_BG = '#F6F5F1' // matches the app shell, so no white flash on launch

// Remember where the window was, so it reopens where they left it.
const stateFile = () => path.join(app.getPath('userData'), 'window-state.json')
function readState() {
  try { return JSON.parse(fs.readFileSync(stateFile(), 'utf8')) } catch { return {} }
}
function saveState(win) {
  if (!win || win.isDestroyed()) return
  try {
    const b = win.getNormalBounds()
    fs.writeFileSync(stateFile(), JSON.stringify({ ...b, maximized: win.isMaximized() }))
  } catch { /* a lost window position is not worth an error dialog */ }
}

// Anything that isn't the portal opens in the real browser — Xero consent
// screens, Stripe dashboards, a member's website. Keeps the shell from
// becoming a second-rate browser with no address bar to escape from.
function isPortal(url) {
  try { return new URL(url).host === PORTAL_HOST } catch { return false }
}
function openExternally(url) {
  if (/^https?:/i.test(url)) shell.openExternal(url)
}

function createWindow() {
  const s = readState()
  const win = new BrowserWindow({
    width: s.width ?? 1440,
    height: s.height ?? 900,
    x: s.x, y: s.y,
    minWidth: 1024,
    minHeight: 640,
    backgroundColor: BRAND_BG,
    title: 'Hexa Space Admin',
    autoHideMenuBar: process.platform !== 'darwin', // Alt reveals it on Windows
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: true,
    },
  })
  if (s.maximized) win.maximize()

  win.loadURL(PORTAL_URL)

  // Target=_blank and window.open → system browser, never a chromeless popup.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (isPortal(url)) return { action: 'allow' }
    openExternally(url)
    return { action: 'deny' }
  })

  // Full-page navigations away from the portal go to the browser too.
  win.webContents.on('will-navigate', (e, url) => {
    if (!isPortal(url)) { e.preventDefault(); openExternally(url) }
  })

  // If the portal is unreachable (no wifi, Vercel mid-deploy) say so plainly
  // and offer a retry rather than showing a Chrome error page.
  win.webContents.on('did-fail-load', (_e, code, desc, url, isMainFrame) => {
    if (!isMainFrame || code === -3) return // -3 = user aborted
    dialog.showMessageBox(win, {
      type: 'warning',
      title: "Can't reach the portal",
      message: "Couldn't load the Hexa Space admin portal.",
      detail: `${desc} (${code})\n${url}\n\nCheck your internet connection and try again.`,
      buttons: ['Retry', 'Close'],
      defaultId: 0,
    }).then(({ response }) => { if (response === 0) win.loadURL(PORTAL_URL) })
  })

  ;['resize', 'move', 'close'].forEach((ev) => win.on(ev, () => saveState(win)))
  return win
}

// Downloads (invoices, agreements, the Maxa fob order form, directory-board
// PNGs) save to the user's Downloads folder and are revealed on completion —
// no silent saves into a folder nobody can find.
function wireDownloads() {
  session.defaultSession.on('will-download', (_e, item) => {
    const target = path.join(app.getPath('downloads'), item.getFilename())
    item.once('done', (_ev, state) => {
      if (state === 'completed') shell.showItemInFolder(item.getSavePath() || target)
    })
  })
}

function buildMenu(getWin) {
  const isMac = process.platform === 'darwin'
  const template = [
    ...(isMac ? [{ role: 'appMenu' }] : []),
    {
      label: 'File',
      submenu: [
        {
          label: 'Print…',
          accelerator: 'CmdOrCtrl+P',
          click: () => getWin()?.webContents.print({}),
        },
        { type: 'separator' },
        isMac ? { role: 'close' } : { role: 'quit' },
      ],
    },
    // Without this, copy/paste shortcuts do nothing on macOS.
    { role: 'editMenu' },
    {
      label: 'View',
      submenu: [
        { label: 'Back', accelerator: 'CmdOrCtrl+[', click: () => getWin()?.webContents.navigationHistory.goBack() },
        { label: 'Forward', accelerator: 'CmdOrCtrl+]', click: () => getWin()?.webContents.navigationHistory.goForward() },
        { role: 'reload' },
        { role: 'forceReload' },
        { type: 'separator' },
        { role: 'resetZoom' }, { role: 'zoomIn' }, { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
        { role: 'toggleDevTools' },
      ],
    },
    { role: 'windowMenu' },
    {
      role: 'help',
      submenu: [
        { label: 'Open portal in browser', click: () => openExternally(PORTAL_URL) },
        {
          label: 'About',
          click: () => dialog.showMessageBox({
            type: 'info',
            title: 'Hexa Space Admin',
            message: `Hexa Space Admin ${app.getVersion()}`,
            detail: `Connected to ${PORTAL_URL}\nElectron ${process.versions.electron} · Chromium ${process.versions.chrome}`,
          }),
        },
      ],
    },
  ]
  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

// One window only — a second launch focuses the existing one.
if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  let mainWindow = null
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()
    }
  })

  app.whenReady().then(() => {
    app.setAppUserModelId('au.com.hexaspace.admin') // Windows taskbar grouping
    wireDownloads()
    mainWindow = createWindow()
    buildMenu(() => mainWindow)

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) mainWindow = createWindow()
    })

    // Auto-update only runs in a packaged, published build — electron-updater
    // throws in dev and on builds with no publish feed configured.
    if (app.isPackaged) {
      try {
        const { autoUpdater } = require('electron-updater')
        autoUpdater.checkForUpdatesAndNotify().catch(() => {})
      } catch { /* no update feed configured yet */ }
    }
  })

  app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit() })
}
