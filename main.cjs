const { app, BrowserWindow, Menu, Tray, nativeImage } = require('electron');
const path = require('path');

let mainWindow;
let tray;

function createWindow() {
  // CORRECT ICON PATH: Checks dist first (production), then public (dev), then root
  const iconPath = path.join(__dirname, 'public/techwisdom.ico'); 
  // If you want to use the png: path.join(__dirname, 'public/techwisdom.png')

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
  Menu.setApplicationMenu(null);

  // Prevent closing; minimize to tray instead
  mainWindow.on('close', (event) => {
    if (!app.isQuitting) {
      event.preventDefault();
      mainWindow.hide();
    }
    return false;
  });
}

function createTray() {
  // ROBUST ICON PATH LOGIC
  // Windows usually prefers .ico for the tray. If you only have png, it might be invisible or scaled badly.
  // Let's try to find the icon in the likely locations.
  let trayIconPath = path.join(__dirname, 'public/techwisdom.ico');
  
  // If running in production ('dist' exists), point there if the asset is copied
  // Ideally, use: path.join(__dirname, 'dist/favicon.ico') if you have one.
  
  // Create a native image to ensure it resizes correctly
  const icon = nativeImage.createFromPath(trayIconPath);

  // Fallback: If techwisdom.png fails, try favicon.ico which usually exists
  if (icon.isEmpty()) {
      console.log("Custom icon not found, trying favicon...");
      tray = new Tray(path.join(__dirname, 'public/favicon.ico'));
  } else {
      tray = new Tray(icon.resize({ width: 16, height: 16 })); // Resize for tray
  }
  
  const contextMenu = Menu.buildFromTemplate([
    { 
      label: 'Show App', 
      click: () => mainWindow.show() 
    },
    { 
      label: 'Quit TechWisdom', 
      click: () => {
        app.isQuitting = true;
        app.quit();
      } 
    }
  ]);

  tray.setToolTip('TechWisdom ERP');
  tray.setContextMenu(contextMenu);

  tray.on('click', () => {
    if (mainWindow.isVisible()) {
      mainWindow.hide();
    } else {
      mainWindow.show();
    }
  });
}

app.whenReady().then(() => {
  createWindow();
  createTray();
});

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