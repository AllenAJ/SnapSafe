const { app, BrowserWindow, ipcMain, Tray, Menu, dialog, desktopCapturer, screen, globalShortcut, clipboard, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');
require('dotenv').config();
const { execFile } = require('child_process');

const sharp = require('sharp');
const crypto = require('crypto');
let quickAccessWindow = null;
let currentScreenshotPath = null;
// Add Pinata SDK
const pinataSDK = require('@pinata/sdk');
const pinata = new pinataSDK({ pinataJWTKey: process.env.PINATA_JWT });

let mainWindow = null;
let tray = null;

function createWindow() {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;
  

    // Register global shortcut
    globalShortcut.register('CommandOrControl+Shift+S', () => {
      captureScreenshot();
    });


  mainWindow = new BrowserWindow({
    width: width,
    height: height,
    webPreferences: {
      contextIsolation: false, // Be cautious with this setting
      nodeIntegration: true,
      additionalArguments: [`--imgur-client-id=${process.env.IMGUR_CLIENT_ID}`]
    },
    show: false,
    frame: false,
    backgroundColor: '#f0f0f0',
    skipTaskbar: true, // Hide from taskbar
  });

  mainWindow.loadFile('index.html');
  
  mainWindow.on('close', function (event) {
    if (!app.isQuitting) {
      event.preventDefault();
      mainWindow.hide();
    }
    return false;
  });

  mainWindow.on('hide', () => {
    // Send a message to the renderer process to clear the canvas
    mainWindow.webContents.send('clear-canvas');
  });
}

app.whenReady().then(() => {


  if (process.platform === 'darwin') {
    app.dock.hide(); // Hide the dock icon on macOS
  }
  
  createWindow();

  // Add a tray icon
  const trayIcon = path.join(__dirname, '/assets/icons.png');  // Replace this with your tray icon
  tray = new Tray(trayIcon);

  const trayMenu = Menu.buildFromTemplate([
    { label: 'Capture Screenshot', click: captureScreenshot },
    { label: 'Quit', click: () => {
      app.isQuitting = true;
      app.quit();
    }}
  ]);

  tray.setToolTip('Screenshot App');
  tray.setContextMenu(trayMenu);
});

function generateUniqueFileName() {
  return `screenshot-${Date.now()}-${crypto.randomBytes(4).toString('hex')}.png`;
}

function captureScreenshot() {
  const tempPath = path.join(app.getPath('temp'), `screenshot-${Date.now()}.png`);
  
  execFile('screencapture', ['-i', '-s', tempPath], (error) => {
    if (error) {
      console.error('Error capturing screenshot:', error);
      dialog.showErrorBox('Screenshot Error', `Failed to capture screenshot: ${error.message}`);
      return;
    }

    fs.access(tempPath, fs.constants.F_OK, (err) => {
      if (err) {
        console.log('Screenshot was canceled or failed');
        return;
      }

      currentScreenshotPath = tempPath;
      createQuickAccessWindow(currentScreenshotPath);
    });
  });
}

function createQuickAccessWindow(screenshotPath) {
  const { screen } = require('electron');
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width, height } = primaryDisplay.workAreaSize;

  quickAccessWindow = new BrowserWindow({
    width: 240,
    height: 220, // Increased height to accommodate the new button
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    x: width - 260, // Position in the bottom-right corner
    y: height - 240, // Adjusted for the new height
    webPreferences: {
      contextIsolation: false,
      nodeIntegration: true
    }
  });

  quickAccessWindow.loadFile('quick-access.html');

  quickAccessWindow.webContents.on('did-finish-load', () => {
    const screenshotDataUrl = `file://${screenshotPath}`;
    quickAccessWindow.webContents.send('screenshot-data', screenshotDataUrl);
  });

  quickAccessWindow.on('closed', () => {
    quickAccessWindow = null;
  });


  // Auto-hide the notification after 5 seconds
  setTimeout(() => {
    if (quickAccessWindow) {
      quickAccessWindow.close();
    }
  }, 5000);
}


function cleanupOldScreenshots(callback) {
  const tempDir = app.getPath('temp');
  const now = Date.now();
  const oneHourAgo = now - 60 * 60 * 1000; // 1 hour in milliseconds

  fs.readdir(tempDir, (err, files) => {
    if (err) {
      console.error('Error reading temp directory:', err);
      return callback(err);
    }

    let completed = 0;
    let errors = [];

    if (files.length === 0) {
      return callback(null);
    }

    files.forEach((file) => {
      if (file.startsWith('screenshot-')) {
        const filePath = path.join(tempDir, file);
        fs.stat(filePath, (statErr, stats) => {
          if (statErr) {
            errors.push(statErr);
          } else if (stats.mtimeMs < oneHourAgo) {
            fs.unlink(filePath, (unlinkErr) => {
              if (unlinkErr) {
                errors.push(unlinkErr);
              } else {
                console.log(`Deleted old screenshot: ${filePath}`);
              }
            });
          }

          completed++;
          if (completed === files.length) {
            if (errors.length > 0) {
              callback(new Error('Some errors occurred during cleanup: ' + errors.join(', ')));
            } else {
              callback(null);
            }
          }
        });
      } else {
        completed++;
        if (completed === files.length) {
          if (errors.length > 0) {
            callback(new Error('Some errors occurred during cleanup: ' + errors.join(', ')));
          } else {
            callback(null);
          }
        }
      }
    });
  });
}

// Add this function to handle Pinata upload
async function uploadToPinata(filePath) {
  try {
    const readableStreamForFile = fs.createReadStream(filePath);
    const options = {
      pinataMetadata: {
        name: `Screenshot-${Date.now()}`
      },
      pinataOptions: {
        cidVersion: 0
      }
    };
    const result = await pinata.pinFileToIPFS(readableStreamForFile, options);
    return `https://gateway.pinata.cloud/ipfs/${result.IpfsHash}`;
  } catch (error) {
    console.error('Error uploading to Pinata:', error);
    throw error;
  }
}

ipcMain.on('close-window', () => {
  if (mainWindow) {
    mainWindow.destroy();
    mainWindow = null;
  }
});

ipcMain.handle('save-screenshot', async (event, imageDataURL, shouldUploadToPinata) => {
  try {
    const result = await dialog.showSaveDialog({
      filters: [{ name: 'PNG Image', extensions: ['png'] }]
    });

    if (result.canceled) {
      return { success: false, canceled: true };
    }

    const filePath = result.filePath;
    
    const base64Data = imageDataURL.replace(/^data:image\/png;base64,/, "");
    
    fs.writeFileSync(filePath, base64Data, 'base64');

    let pinataUrl = null;
    if (shouldUploadToPinata) {
      pinataUrl = await uploadToPinata(filePath);
    }

    return { success: true, filePath, pinataUrl };
  } catch (error) {
    console.error('Error saving screenshot:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.on('copy-screenshot', (event) => {
  if (currentScreenshotPath) {
    const image = nativeImage.createFromPath(currentScreenshotPath);
    clipboard.writeImage(image);
    if (quickAccessWindow) {
      quickAccessWindow.webContents.send('show-feedback', 'Copied to clipboard');
    }
  } else {
    console.error('No screenshot path available');
    if (quickAccessWindow) {
      quickAccessWindow.webContents.send('show-feedback', 'Copy failed');
    }
  }
});

ipcMain.on('edit-screenshot', (event) => {
  if (currentScreenshotPath) {
    if (!mainWindow) {
      createWindow();
    }
    mainWindow.webContents.on('did-finish-load', () => {
      mainWindow.webContents.send('load-screenshot', currentScreenshotPath);
    });
    mainWindow.loadFile('index.html'); // Ensure the main window is loaded with the correct HTML
    mainWindow.show();
    mainWindow.focus();
    if (quickAccessWindow) {
      quickAccessWindow.close();
    }
  } else {
    console.error('No screenshot path available for editing');
  }
});

// Add this new IPC handler
ipcMain.on('upload-screenshot', (event) => {
  // Implement your upload logic here
  console.log('Upload screenshot functionality to be implemented');
});

ipcMain.on('close-quick-access', () => {
  if (quickAccessWindow) {
    quickAccessWindow.close();
  }
});

// Quit when all windows are closed, except on macOS
app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('will-quit', () => {
  // Unregister the shortcut when the app is about to quit
  globalShortcut.register('CommandOrControl+Shift+S', () => {
    captureScreenshot();
  });
});

app.on('activate', function () {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

// Add this to ensure the app quits properly
app.on('before-quit', () => {
  app.isQuitting = true;
});

// Add this new IPC handler
ipcMain.on('hide-window', () => {
  if (mainWindow) {
    mainWindow.webContents.send('clear-canvas');
    mainWindow.hide();
  }
});

app.on('ready', () => {
  cleanupOldScreenshots((err) => {
    if (err) {
      console.error('Error during cleanup:', err);
    } else {
      console.log('Old screenshots cleaned up successfully');
    }})
  });