import { app, BrowserWindow, shell } from 'electron'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { fork } from 'node:child_process'
import os from 'node:os'
import fs from 'node:fs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged

let mainWindow = null
let serverProcess = null

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
  const serverScript = path.join(__dirname, 'dist', 'server', 'server.js')
  
  if (!fs.existsSync(serverScript)) {
    console.error(`[Electron] Production server script not found at: ${serverScript}`)
    return
  }

  console.log('[Electron] Starting production backend server...')
  
  serverProcess = fork(serverScript, [], {
    env: {
      ...process.env,
      NODE_ENV: 'production',
      PORT: '3000',
      HOST: '0.0.0.0', // Allow LAN access
      DATABASE_PATH: dbPath
    },
    silent: false // pipe stdout/stderr to main process
  })

  serverProcess.on('error', (err) => {
    console.error('[Electron] Server child process error:', err)
  })

  serverProcess.on('exit', (code) => {
    console.log(`[Electron] Server child process exited with code ${code}`)
  })
}

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    title: 'Barangay Handumanan BHIMS',
    icon: path.join(__dirname, 'public', 'favicon.ico'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  })

  // Remove default menu bar
  mainWindow.setMenuBarVisibility(false)

  // Redirect link clicks to default browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  if (isDev) {
    console.log('[Electron] Running in development mode, loading localhost...')
    mainWindow.loadURL('http://localhost:3000')
    // Open DevTools in dev
    mainWindow.webContents.openDevTools()
  } else {
    // Start production server first
    startProductionServer()
    
    // Wait for server to start, then load URL
    console.log('[Electron] Waiting for server to spin up...')
    setTimeout(() => {
      mainWindow.loadURL('http://localhost:3000')
    }, 1500)
  }

  mainWindow.on('closed', () => {
    mainWindow = null
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

  app.on('ready', createWindow)

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
