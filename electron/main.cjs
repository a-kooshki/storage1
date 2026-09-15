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
      return { stones: [], stoneTypes: ['Granite', 'Marble', 'Limestone'], settings: {} };
    }
    throw error;
  }
}

async function writeDataFile(data) {
  const filePath = getDataFilePath();
  const safeData = {
    stones: Array.isArray(data?.stones) ? data.stones : [],
    stoneTypes: Array.isArray(data?.stoneTypes) ? data.stoneTypes : ['Granite', 'Marble', 'Limestone'],
    settings: data?.settings && typeof data.settings === 'object' ? data.settings : {},
  };
  const temporaryPath = `${filePath}.tmp`;
  await fs.writeFile(temporaryPath, JSON.stringify(safeData, null, 2), 'utf-8');
  await fs.rename(temporaryPath, filePath);
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
let saveQueue = Promise.resolve();
ipcMain.handle('data:save', async (_event, data) => {
  saveQueue = saveQueue.catch(() => undefined).then(() => writeDataFile(data));
  return saveQueue;
});

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
