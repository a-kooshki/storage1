const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs/promises');
const fsSync = require('fs');

const isDev = !app.isPackaged;
const dataFileName = 'stone-inventory-data.json';

function getDataFilePath() {
  return path.join(app.getPath('userData'), dataFileName);
}

async function readDataFile() {
  const filePath = getDataFilePath();
  try {
    const raw = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(raw);
  } catch (error) {
    if (error.code === 'ENOENT') {
      return { stones: [], stoneTypes: ['Granite', 'Marble', 'Limestone'] };
    }
    throw error;
  }
}

async function writeDataFile(data) {
  const filePath = getDataFilePath();
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
  return { success: true };
}


function resolveWindowIcon() {
  const pngIcon = path.join(__dirname, '../build/icon.png');
  return fsSync.existsSync(pngIcon) ? pngIcon : undefined;
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    icon: resolveWindowIcon(),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (isDev) {
    win.loadURL('http://127.0.0.1:5173');
    win.webContents.openDevTools({ mode: 'detach' });
  } else {
    win.loadFile(path.join(__dirname, '../dist/index.html'));
  }
}

ipcMain.handle('data:load', readDataFile);
ipcMain.handle('data:save', async (_event, data) => writeDataFile(data));

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
