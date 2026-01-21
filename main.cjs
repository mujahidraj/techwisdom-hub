const { app, BrowserWindow, Menu, Tray, nativeImage, globalShortcut, shell, Notification } = require('electron');
const path = require('path');

let mainWindow;
let splashWindow; // New variable for the splash screen
let tray;
let isQuitting = false;

if (process.platform === 'win32') {
  app.setAppUserModelId('com.techwisdom.erp');
}

// Feature: Run on Startup
app.setLoginItemSettings({
  openAtLogin: true,
  path: process.execPath,
  args: ['--process-start-args', `"--hidden"`]
});

function getIconPath() {
  return path.join(__dirname, 'dist/techwisdom.ico');
}

function createSplash() {
  splashWindow = new BrowserWindow({
    width: 500,
    height: 300,
    transparent: false,
    frame: false, // Removes the window border (looks cool)
    alwaysOnTop: true,
    icon: getIconPath(),
    webPreferences: {
      nodeIntegration: false
    }
  });
  
  // Load the splash.html from the dist folder
  splashWindow.loadFile(path.join(__dirname, 'dist/splash.html'));
  splashWindow.center();
}

function createWindow() {
  const iconPath = getIconPath();

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    title: "TechWisdom ERP",
    icon: iconPath,
    show: false, // Don't show immediately (wait for splash)
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      spellcheck: true
    },
  });

  mainWindow.loadFile(path.join(__dirname, 'dist/index.html'));
  Menu.setApplicationMenu(null);

  // --- Feature: Download Manager ---
  mainWindow.webContents.session.on('will-download', (event, item, webContents) => {
    // Show a notification when download starts
    new Notification({
      title: 'Downloading...',
      body: item.getFilename()
    }).show();

    item.once('done', (event, state) => {
      if (state === 'completed') {
        const notif = new Notification({
          title: 'Download Complete',
          body: `${item.getFilename()} has been saved.`
        });
        notif.show();
        
        // Click notification to show file in folder
        notif.on('click', () => {
          shell.showItemInFolder(item.getSavePath());
        });
      }
    });
  });

  // --- Smart Link Handling ---
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http')) {
      shell.openExternal(url);
      return { action: 'deny' };
    }
    return { action: 'allow' };
  });

  // --- Wait for React to Load before showing ---
  mainWindow.once('ready-to-show', () => {
    // Simulate a small delay so the user sees the splash screen (looks professional)
    setTimeout(() => {
      if (splashWindow) {
        splashWindow.close();
        splashWindow = null;
      }
      mainWindow.show();
      mainWindow.focus();
    }, 2000); // 2 seconds splash screen
  });

  // --- Minimize/Tray Logic ---
  mainWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault();
      mainWindow.hide();
    }
    return false;
  });
}

function createTray() {
  const iconPath = getIconPath();
  const trayIcon = nativeImage.createFromPath(iconPath);
  
  tray = new Tray(trayIcon);
  
  const contextMenu = Menu.buildFromTemplate([
    { label: 'Open TechWisdom', click: () => mainWindow.show() },
    { type: 'separator' },
    { label: 'Quit', click: () => { isQuitting = true; app.quit(); } }
  ]);

  tray.setToolTip('TechWisdom ERP');
  tray.setContextMenu(contextMenu);
  tray.on('click', () => {
    if (mainWindow.isVisible()) { mainWindow.hide(); } 
    else { mainWindow.show(); mainWindow.focus(); }
  });
}

const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) { app.quit(); } 
else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
  });

  app.whenReady().then(() => {
    createSplash(); // 1. Show Splash First
    createWindow(); // 2. Start loading Main App in background
    createTray();

    // Shortcuts
    globalShortcut.register('CommandOrControl+=', () => {
      mainWindow.webContents.setZoomLevel(mainWindow.webContents.getZoomLevel() + 0.5);
    });
    globalShortcut.register('CommandOrControl+-', () => {
      mainWindow.webContents.setZoomLevel(mainWindow.webContents.getZoomLevel() - 0.5);
    });
    globalShortcut.register('CommandOrControl+0', () => {
      mainWindow.webContents.setZoomLevel(0);
    });
    globalShortcut.register('F11', () => {
      mainWindow.setFullScreen(!mainWindow.isFullScreen());
    });
  });
  
  app.on('will-quit', () => { globalShortcut.unregisterAll(); });
  app.on('before-quit', () => { isQuitting = true; });
}