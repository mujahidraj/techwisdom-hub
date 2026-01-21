const { app, BrowserWindow, Menu, Tray, nativeImage } = require('electron');
const path = require('path');

let mainWindow;
let tray;

function getIconPath() {
  // CRITICAL FIX: In production, the 'public' folder doesn't exist. 
  // Vite copies everything from 'public' to 'dist'.
  // So we always look inside 'dist' for the icon.
  return path.join(__dirname, 'dist/techwisdom.ico');
}

function createWindow() {
  const iconPath = getIconPath();

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    title: "TechWisdom ERP",
    icon: iconPath,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  mainWindow.loadFile(path.join(__dirname, 'dist/index.html'));
  
  // Remove the top menu bar
  Menu.setApplicationMenu(null);

  // --- PREVENT CLOSING LOGIC ---
  mainWindow.on('close', (event) => {
    // If the user clicked "Quit" in the tray, actually quit.
    // Otherwise, just hide the window.
    if (!app.isQuitting) {
      event.preventDefault();
      mainWindow.hide();
    }
    return false;
  });
}

function createTray() {
  const iconPath = getIconPath();
  
  // Create the tray icon using the .ico file
  // We use nativeImage to ensure it loads reliably from the ASAR package
  const trayIcon = nativeImage.createFromPath(iconPath);
  
  tray = new Tray(trayIcon);
  
  const contextMenu = Menu.buildFromTemplate([
    { 
      label: 'Open TechWisdom', 
      click: () => mainWindow.show() 
    },
    { type: 'separator' },
    { 
      label: 'Quit', 
      click: () => {
        app.isQuitting = true;
        app.quit();
      } 
    }
  ]);

  tray.setToolTip('TechWisdom ERP');
  tray.setContextMenu(contextMenu);

  // Restore the app when clicking the tray icon
  tray.on('click', () => {
    if (mainWindow.isVisible()) {
      mainWindow.hide();
    } else {
      mainWindow.show();
      mainWindow.focus();
    }
  });
}

// Initialize
app.whenReady().then(() => {
  createWindow();
  createTray();
});

// Single Instance Lock (Prevents opening 2 apps)
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
  });
}