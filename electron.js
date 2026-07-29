import { app, BrowserWindow, shell, Menu, Tray, dialog } from 'electron'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { fork } from 'node:child_process'
import os from 'node:os'
import fs from 'node:fs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged

let mainWindow = null
let serverProcess = null
let tray = null
let isQuitting = false

// Resolve icon path — inside ASAR in dev, outside (extraResources) in production
function getIconPath() {
  if (isDev) {
    return path.join(__dirname, 'public', 'barangay_logo.png')
  }
  return path.join(process.resourcesPath, 'barangay_logo.png')
}

// Expose the local IP address through an environment variable
// so that the server can retrieve and display it on the UI
function getLocalIP() {
  const interfaces = os.networkInterfaces()
  for (const name of Object.keys(interfaces)) {
    const iface = interfaces[name]
    if (!iface) continue
    for (const net of iface) {
      if (net.family === 'IPv4' && !net.internal) {
        return net.address
      }
    }
  }
  return '127.0.0.1'
}

const localIp = getLocalIP()
process.env.SERVER_IP = localIp

// Configure database path in persistent AppData
const userDataPath = app.getPath('userData')
const dbPath = path.join(userDataPath, 'bhims.db')
process.env.DATABASE_PATH = dbPath

console.log(`[Electron] AppData directory: ${userDataPath}`)
console.log(`[Electron] Local IP Address resolved: ${localIp}`)

function startProductionServer() {
  // Read from extraResources directory directly
  const serverPath = process.resourcesPath
  const serverScript = path.join(serverPath, 'prod-server.js')

  console.log('[Electron] Starting production server at:', serverScript)

  // Ensure ESM support for the server script
  const pkgJsonPath = path.join(serverPath, 'package.json')
  if (!fs.existsSync(pkgJsonPath)) {
    fs.writeFileSync(pkgJsonPath, JSON.stringify({ type: 'module' }))
    console.log('[Electron] Created unpacked/package.json for ESM support')
  }

  const env = {
    ...process.env,
    PORT: '3000',
    HOST: '0.0.0.0', // Allow LAN access
    NODE_ENV: 'production',
    DATABASE_PATH: dbPath,
    RESOURCES_PATH: process.resourcesPath,
    USER_DATA_PATH: app.getPath('userData'),
    MIGRATIONS_PATH: path.join(serverPath, 'drizzle'),
  }

  console.log('[Electron] Starting production backend server...')
  
  serverProcess = fork(serverScript, [], {
    env: env,
    silent: true // Capture stdout/stderr manually
  })

  const logFile = path.join(app.getPath('desktop'), 'bhims-crash-log.txt')
  fs.writeFileSync(logFile, '--- BHIMS SERVER LOG ---\n')

  serverProcess.stdout.on('data', (data) => {
    fs.appendFileSync(logFile, `[STDOUT] ${data.toString()}`)
  })

  serverProcess.stderr.on('data', (data) => {
    fs.appendFileSync(logFile, `[STDERR] ${data.toString()}`)
  })

  serverProcess.on('error', (err) => {
    fs.appendFileSync(logFile, `[ERROR] ${err.toString()}\n`)
  })

  serverProcess.on('exit', (code) => {
    fs.appendFileSync(logFile, `[EXIT] Process exited with code ${code}\n`)
  })
}

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    title: 'Barangay Handumanan BHIMS',
    icon: getIconPath(),
    show: false, // Don't show until fully loaded to prevent white screen flicker
    backgroundColor: '#ffffff', // Match the default theme background
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  })

  // Show and maximize ONLY when the app is fully rendered and ready
  mainWindow.once('ready-to-show', () => {
    mainWindow.maximize()
    mainWindow.show()
  })

  // Completely remove the browser menu bar (File, Edit, View, etc)
  mainWindow.removeMenu()

  // Redirect link clicks to default browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  if (isDev) {
    console.log('[Electron] Running in development mode, loading localhost...')
    mainWindow.loadURL('http://localhost:3000')
  } else {
    // Start production server first
    startProductionServer()
    
    // Load as soon as possible without hardcoded 1.5s delay
    console.log('[Electron] Waiting for server to spin up...')
    let attempts = 0
    const tryLoad = () => {
      attempts++
      mainWindow.loadURL('http://localhost:3000').catch((err) => {
        console.log(`[Electron] Server not ready yet (attempt ${attempts}), retrying in 100ms...`)
        if (attempts > 100) {
          // After 10 seconds of retrying, show the error
          dialog.showErrorBox('BHIMS Server Failed to Start',
            `The backend server could not be reached after ${attempts} attempts.\n\nServer script: ${path.join(process.resourcesPath, 'app.asar.unpacked', 'dist', 'server', 'server.js')}\n\nError: ${err.message}`)
          return
        }
        setTimeout(tryLoad, 100)
      })
    }
    setTimeout(tryLoad, 200) // Start checking almost instantly
  }

  mainWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault()
      mainWindow.hide() // Just hide to background, like Discord
    }
    return false
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

function createTray() {
  const iconPath = getIconPath()
  tray = new Tray(iconPath)
  
  const contextMenu = Menu.buildFromTemplate([
    { label: 'Open Dashboard', click: () => { mainWindow?.show(); mainWindow?.focus() } },
    { type: 'separator' },
    { label: 'Quit BHIMS Server', click: () => { isQuitting = true; app.quit() } }
  ])
  
  tray.setToolTip('Barangay Handumanan BHIMS')
  tray.setContextMenu(contextMenu)
  
  tray.on('double-click', () => {
    if (mainWindow) {
      mainWindow.show()
      mainWindow.focus()
    }
  })
}

// Single instance lock (prevent multiple app instances)
const gotTheLock = app.requestSingleInstanceLock()

if (!gotTheLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()
    }
  })

  // Set to launch automatically when the computer boots up (production only)
  if (!isDev) {
    app.setLoginItemSettings({
      openAtLogin: true,
      path: app.getPath('exe')
    })
  }

  app.on('ready', () => {
    createWindow()
    createTray()
  })

  app.on('window-all-closed', () => {
    // Kill the backend server process on window close
    if (serverProcess) {
      console.log('[Electron] Terminating backend server...')
      serverProcess.kill()
    }
    
    if (process.platform !== 'darwin') {
      app.quit()
    }
  })

  app.on('activate', () => {
    if (mainWindow === null) {
      createWindow()
    }
  })
}
