const { ipcRenderer } = require('electron');
const { handleEyedropperTool } = require('./tools/EyedropperTool.js');
const { createTextInput } = require('./tools/TextTool.js');
const { changeColor,changeLineWidth } = require('./utils/colorUtils.js');
const { saveState, undo } = require('./utils/undo.js');
const axios = require('axios');
const os = require('os');
const fs = require('fs');
const path = require('path');
let canvas, ctx;
let currentTool = null;
let isDrawing = false;
let undoStack = [];
let scaleFactor = 1;
const WALRUS_API = "http://127.0.0.1:31415"; // Adjust if your Walrus daemon is running on a different address
<<<<<<< HEAD
const WALRUS_PUBLISHER = "https://publisher.walrus-testnet.walrus.space";
=======
const WALRUS_PUBLISHER = "https://walrus-testnet-publisher.nodeinfra.com";
>>>>>>> 1e693ed (snapsafe project)

// Crop tool variables
let isCropping = false;
let cropStart = { x: 0, y: 0 };
let cropEnd = { x: 0, y: 0 };
let originalImageData;
let isCropMode = false;
let originalCanvas, originalCtx;
let currentColor = '#FF0000'; // Store the current color
let currentLineWidth = 1; // Store the current line width
let isResizing = false;
let resizeHandle = '';
let cropStartDrag = null;
const imgurClientId = null;
let lastUploadTime = 0;
const COOLDOWN_PERIOD = 60000; // 1 minute in milliseconds
//const imgurClientId = process.argv.find(arg => arg.startsWith('--imgur-client-id=')).split('=')[1];

let isSelecting = false;
let startX, startY, endX, endY;

function initializeCanvas() {
  canvas = document.getElementById('screenshot-canvas');
  if (canvas) {
    ctx = canvas.getContext('2d');
    ctx.strokeStyle = '#FF0000';
    ctx.fillStyle = '#FF0000';
    
    // Check if colorPicker exists before trying to access its value
    const colorPicker = document.getElementById('colorPicker');
    if (colorPicker) {
      colorPicker.value = '#FF0000';
    }

    window.addEventListener('resize', resizeCanvas);

    canvas.addEventListener('mousedown', onMouseDown);
    canvas.addEventListener('mousemove', onMouseMove);
    canvas.addEventListener('mouseup', onMouseUp);

    // Add event listeners for selection if on selection.html
    if (window.location.href.includes('selection.html')) {
      canvas.addEventListener('mousedown', startSelection);
      canvas.addEventListener('mousemove', updateSelection);
      canvas.addEventListener('mouseup', endSelection);
    }
  } else {
    console.error('Canvas element not found');
  }
}

function loadScreenshot(imagePath) {
  if (!canvas || !ctx) {
    console.error('Canvas not initialized');
    return;
  }

  const img = new Image();
  img.onload = function() {
    canvas.width = img.width;
    canvas.height = img.height;
    ctx.drawImage(img, 0, 0);
    resizeCanvas();
  };
  img.onerror = function() {
    console.error('Error loading image:', imagePath);
  };
  img.src = `file://${imagePath}`;
}

function startSelection(e) {
  isSelecting = true;
  startX = e.clientX;
  startY = e.clientY;
}

function updateSelection(e) {
  if (!isSelecting) return;

  endX = e.clientX;
  endY = e.clientY;

  drawSelectionOverlay();
}

function endSelection() {
  isSelecting = false;
  const x = Math.min(startX, endX);
  const y = Math.min(startY, endY);
  const width = Math.abs(endX - startX);
  const height = Math.abs(endY - startY);

  ipcRenderer.send('capture-area', { x, y, width, height });
}

function drawSelectionOverlay() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const x = Math.min(startX, endX);
  const y = Math.min(startY, endY);
  const width = Math.abs(endX - startX);
  const height = Math.abs(endY - startY);

  ctx.clearRect(x, y, width, height);
  ctx.strokeStyle = 'white';
  ctx.strokeRect(x, y, width, height);
}

// Modify the resizeCanvas function to maintain image quality
function resizeCanvas() {
  const container = document.getElementById('canvas-container');
  const toolbarHeight = document.getElementById('toolbar').offsetHeight;
  const availableHeight = window.innerHeight - toolbarHeight;

  container.style.height = `${availableHeight}px`;

  if (canvas) {
    const containerWidth = container.offsetWidth;
    const containerHeight = container.offsetHeight;
    const imageAspectRatio = canvas.width / canvas.height;
    const containerAspectRatio = containerWidth / containerHeight;

    let newWidth, newHeight;

    if (imageAspectRatio > containerAspectRatio) {
      newWidth = containerWidth;
      newHeight = containerWidth / imageAspectRatio;
    } else {
      newHeight = containerHeight;
      newWidth = containerHeight * imageAspectRatio;
    }

    // Create a temporary canvas for high-quality resizing
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = newWidth;
    tempCanvas.height = newHeight;
    const tempCtx = tempCanvas.getContext('2d');
    tempCtx.imageSmoothingEnabled = true;
    tempCtx.imageSmoothingQuality = 'high';

    // Draw the original canvas content onto the temporary canvas
    tempCtx.drawImage(canvas, 0, 0, canvas.width, canvas.height, 0, 0, newWidth, newHeight);

    // Update the main canvas size
    canvas.width = newWidth;
    canvas.height = newHeight;

    // Draw the resized image back to the main canvas
    ctx.drawImage(tempCanvas, 0, 0);

    canvas.style.width = `${newWidth}px`;
    canvas.style.height = `${newHeight}px`;

    scaleFactor = canvas.width / newWidth;
  }
}

function getMousePos(event) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: (event.clientX - rect.left) * scaleFactor,
    y: (event.clientY - rect.top) * scaleFactor
  };
}

function resetAppState() {
  if (canvas && ctx) {
    // Clear the canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Reset canvas size
    canvas.width = 0;
    canvas.height = 0;
    
    // Reset any other state variables
    currentTool = null;
    isDrawing = false;
    undoStack = [];
    // Reset any other variables you've defined
  }
}

// Modify the setTool function
function setTool(tool) {
  if (currentTool === 'CROP' && tool !== 'CROP') {
    endCropMode();
  }
  currentTool = tool;
  console.log(`Tool switched to: ${tool}`);
  if (tool === 'CROP') {
    startCropMode();
  } else {
    canvas.style.cursor = 'default';
    // Ensure the current color and line width are set when changing tools
    changeColor(currentColor);
    changeLineWidth(currentLineWidth);
  }
}
// Modify the startCropMode function
function startCropMode() {
  isCropMode = true;
  canvas.style.cursor = 'crosshair';
  
  // Create a copy of the original canvas
  originalCanvas = document.createElement('canvas');
  originalCanvas.width = canvas.width;
  originalCanvas.height = canvas.height;
  originalCtx = originalCanvas.getContext('2d');
  originalCtx.drawImage(canvas, 0, 0);
  
  // Store the current context state
  originalStrokeStyle = ctx.strokeStyle;
  originalFillStyle = ctx.fillStyle;
  originalLineWidth = ctx.lineWidth;
  
  // Draw a semi-transparent overlay on the main canvas
  ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}

function applyCrop() {
  const cropWidth = Math.abs(cropEnd.x - cropStart.x);
  const cropHeight = Math.abs(cropEnd.y - cropStart.y);
  const cropX = Math.min(cropStart.x, cropEnd.x);
  const cropY = Math.min(cropStart.y, cropEnd.y);

  // Create a new canvas with the cropped dimensions
  const croppedCanvas = document.createElement('canvas');
  croppedCanvas.width = cropWidth;
  croppedCanvas.height = cropHeight;
  const croppedCtx = croppedCanvas.getContext('2d');

  // Use imageSmoothingEnabled for better quality
  croppedCtx.imageSmoothingEnabled = true;
  croppedCtx.imageSmoothingQuality = 'high';
  
  // Draw the cropped portion from the original canvas
  croppedCtx.drawImage(
    originalCanvas,
    cropX, cropY, cropWidth, cropHeight,
    0, 0, cropWidth, cropHeight
  );
  
  // Resize the main canvas
  canvas.width = cropWidth;
  canvas.height = cropHeight;
  
  // Use imageSmoothingEnabled for the main canvas as well
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  // Draw the cropped image onto the main canvas
  ctx.drawImage(croppedCanvas, 0, 0);
  
  // Restore the current color and line width
  changeColor(currentColor);
  changeLineWidth(currentLineWidth);
  
  cropStart = { x: 0, y: 0 };
  cropEnd = { x: 0, y: 0 };

  // After cropping, resize the canvas to fit the new image size
  resizeCanvas();
}

function endCropMode() {
  isCropMode = false;
  canvas.style.cursor = 'default';
  
  if (originalCanvas && canvas) {
    // If we didn't apply a crop, restore the original image
    if (canvas.width === originalCanvas.width && canvas.height === originalCanvas.height) {
      ctx.drawImage(originalCanvas, 0, 0);
    }
  }
  
  // Restore the current color and line width
  changeColor(currentColor);
  changeLineWidth(currentLineWidth);
  
  // Clean up
  originalCanvas = null;
  originalCtx = null;
}

function onMouseDown(event) {
  if (!canvas || !ctx) return;

  const { x, y } = getMousePos(event);

  console.log('Mouse down at:', x, y);

  if (currentTool === 'TEXT') {
    console.log('Creating text input...');
    createTextInput(canvas, ctx, x, y);
    return;
  }

  if (currentTool === 'CROP') {
    const handle = getResizeHandle(x, y);
    if (handle) {
      isResizing = true;
      resizeHandle = handle.name;
    } else if (x >= cropStart.x && x <= cropEnd.x && y >= cropStart.y && y <= cropEnd.y) {
      isCropping = true;
      cropStartDrag = { x: x - cropStart.x, y: y - cropStart.y };
    } else {
      isCropping = true;
      cropStart = { x, y };
      cropEnd = { x, y };
    }
    return;
  }

  isDrawing = true;
  saveState(ctx, undoStack, canvas);

  if (currentTool === 'PENCIL') {
    ctx.beginPath();
    ctx.moveTo(x, y);
  }

  if (['RECTANGLE', 'ARROW', 'HIGHLIGHT'].includes(currentTool)) {
    ctx.startX = x;
    ctx.startY = y;
    ctx.canvasCopy = ctx.getImageData(0, 0, canvas.width, canvas.height);
  }

  if (currentTool === 'EYEDROPPER') {
    handleEyedropperTool(canvas, ctx, { offsetX: x, offsetY: y });
    isDrawing = false;
  }
}

function onMouseMove(event) {
  if (!canvas || !ctx) return;

  const { x, y } = getMousePos(event);

  if (currentTool === 'CROP') {
    if (isCropping || isResizing) {
      handleCropMouseMove(event);
    } else {
      const handle = getResizeHandle(x, y);
      if (handle) {
        canvas.style.cursor = handle.cursor;
      } else if (x >= cropStart.x && x <= cropEnd.x && y >= cropStart.y && y <= cropEnd.y) {
        canvas.style.cursor = 'move';
      } else {
        canvas.style.cursor = 'crosshair';
      }
    }
    return;
  }

  if (!isDrawing) return;

  if (currentTool === 'PENCIL') {
    ctx.lineTo(x, y);
    ctx.stroke();
  }

  if (currentTool === 'RECTANGLE') {
    ctx.putImageData(ctx.canvasCopy, 0, 0);
    ctx.strokeRect(ctx.startX, ctx.startY, x - ctx.startX, y - ctx.startY);
  }

  if (currentTool === 'HIGHLIGHT') {
    ctx.putImageData(ctx.canvasCopy, 0, 0);
    ctx.fillStyle = 'rgba(255, 255, 0, 0.3)';
    ctx.fillRect(ctx.startX, ctx.startY, x - ctx.startX, y - ctx.startY);
  }

  if (currentTool === 'ARROW') {
    ctx.putImageData(ctx.canvasCopy, 0, 0);
    drawArrow(ctx, ctx.startX, ctx.startY, x, y);
  }
}

function onMouseUp(event) {
  if (!canvas || !ctx) return;

  const { x, y } = getMousePos(event);

  if (currentTool === 'CROP') {
    isResizing = false;
    isCropping = false;
    resizeHandle = '';
    cropStartDrag = null;
    
    const handle = getResizeHandle(x, y);
    if (handle) {
      canvas.style.cursor = handle.cursor;
    } else if (x >= cropStart.x && x <= cropEnd.x && y >= cropStart.y && y <= cropEnd.y) {
      canvas.style.cursor = 'move';
    } else {
      canvas.style.cursor = 'crosshair';
    }
    drawCropOverlay();
    return;
  }

  if (!isDrawing) return;
  isDrawing = false;

  if (currentTool === 'RECTANGLE') {
    ctx.strokeRect(ctx.startX, ctx.startY, x - ctx.startX, y - ctx.startY);
  }

  if (currentTool === 'HIGHLIGHT') {
    ctx.fillStyle = 'rgba(255, 255, 0, 0.3)';
    ctx.fillRect(ctx.startX, ctx.startY, x - ctx.startX, y - ctx.startY);
  }

  if (currentTool === 'ARROW') {
    drawArrow(ctx, ctx.startX, ctx.startY, x, y);
  }
}

function drawArrow(ctx, fromX, fromY, toX, toY) {
  const headLength = 15;
  const angle = Math.atan2(toY - fromY, toX - fromX);

  ctx.beginPath();
  ctx.moveTo(fromX, fromY);
  ctx.lineTo(toX, toY);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(toX, toY);
  ctx.lineTo(toX - headLength * Math.cos(angle - Math.PI / 6), toY - headLength * Math.sin(angle - Math.PI / 6));
  ctx.lineTo(toX - headLength * Math.cos(angle + Math.PI / 6), toY - headLength * Math.sin(angle + Math.PI / 6));
  ctx.lineTo(toX, toY);
  ctx.fill();
}

async function saveScreenshot(uploadToPinata = false, uploadToWalrus = false) {
  if (!canvas) {
    console.error('Canvas not initialized');
    alert('Error: Canvas not initialized');
    return;
  }

  try {
    // Save to a temporary file
    const tempPath = path.join(os.tmpdir(), `temp-screenshot-${Date.now()}.png`);
    const dataURL = canvas.toDataURL('image/png');
    const base64Data = dataURL.replace(/^data:image\/png;base64,/, "");
    fs.writeFileSync(tempPath, base64Data, 'base64');

    const result = await ipcRenderer.invoke('save-screenshot', tempPath, uploadToPinata);
    
    // Delete the temporary file
    fs.unlinkSync(tempPath);

    if (result.success) {
      console.log('Screenshot saved successfully:', result.filePath);
      if (result.pinataUrl) {
        console.log('Screenshot uploaded to Pinata:', result.pinataUrl);
        showShareLink(result.pinataUrl);
      } else {
        alert('Screenshot saved successfully!');
      }
    } else if (result.canceled) {
      console.log('Save operation was canceled by the user');
    } else {
      console.error('Failed to save screenshot:', result.error);
      alert('Failed to save screenshot. Please try again.');
    }

    if (uploadToWalrus) {
      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
      const blobId = await uploadToWalrus(blob);
      console.log('Screenshot uploaded to Walrus:', blobId);
      showShareLink(blobId, 'Walrus');
    }
  } catch (error) {
    console.error('Error saving screenshot:', error);
    alert('An error occurred while saving the screenshot. Please try again.');
  }
}
// Modify the handleCropMouseDown function

async function checkWalrusDaemon() {
  try {
    await axios.get(`${WALRUS_API}/v1/info`);
    console.log('Walrus daemon is running');
    return true;
  } catch (error) {
    console.error('Walrus daemon is not running:', error);
    document.getElementById('upload-to-walrus-button').disabled = true;
    document.getElementById('upload-to-walrus-button').textContent += ' (Unavailable)';
    return false;
  }
}

const WALRUS_AGGREGATOR = "https://aggregator.walrus-testnet.walrus.space";

<<<<<<< HEAD
async function readFromWalrus(blobId) {
  try {
    const response = await axios.get(`${WALRUS_AGGREGATOR}/v1/${blobId}`, {
      responseType: 'arraybuffer'
    });

    if (response.status === 200) {
      return new Blob([response.data], { type: 'image/png' });
    } else {
      throw new Error('Failed to read from Walrus');
    }
  } catch (error) {
    console.error('Error reading from Walrus:', error);
    throw error;
  }
}
=======
// async function readFromWalrus(blobId) {
//   try {
//     const response = await axios.get(`${WALRUS_AGGREGATOR}/v1/${blobId}`, {
//       responseType: 'arraybuffer'
//     });

//     if (response.status === 200) {
//       return new Blob([response.data], { type: 'image/png' });
//     } else {
//       throw new Error('Failed to read from Walrus');
//     }
//   } catch (error) {
//     console.error('Error reading from Walrus:', error);
//     throw error;
//   }
// }
>>>>>>> 1e693ed (snapsafe project)

function handleCropMouseDown(event) {
  if (!isCropMode) return;
  const { x, y } = getMousePos(event);
  
  // Check if we're on a resize handle
  resizeHandle = getResizeHandle(x, y);
  
  if (resizeHandle) {
    isResizing = true;
  } else {
    isCropping = true;
    cropStart = { x, y };
    cropEnd = { x, y };
  }
  drawCropOverlay();
}

// Modify the handleCropMouseMove function
function handleCropMouseMove(event) {
  if (!isCropMode) return;
  const { x, y } = getMousePos(event);
  
  if (isResizing) {
    resizeCropArea(x, y);
  } else if (isCropping) {
    if (cropStartDrag) {
      // Move the crop area
      const dx = x - cropStart.x - cropStartDrag.x;
      const dy = y - cropStart.y - cropStartDrag.y;
      cropStart.x += dx;
      cropStart.y += dy;
      cropEnd.x += dx;
      cropEnd.y += dy;
    } else {
      cropEnd = { x, y };
    }
  }
  
  constrainCropToCanvas();
  drawCropOverlay();
}

// Add this function to ensure crop coordinates are within canvas bounds
function constrainCropToCanvas() {
  cropStart.x = Math.max(0, Math.min(cropStart.x, canvas.width));
  cropStart.y = Math.max(0, Math.min(cropStart.y, canvas.height));
  cropEnd.x = Math.max(0, Math.min(cropEnd.x, canvas.width));
  cropEnd.y = Math.max(0, Math.min(cropEnd.y, canvas.height));
}

function handleCropMouseUp() {
  if (!isCropMode) return;
  isResizing = false;
  isCropping = false;
  resizeHandle = '';
  
  if (Math.abs(cropEnd.x - cropStart.x) > 10 && Math.abs(cropEnd.y - cropStart.y) > 10) {
    // Keep the crop area selected, don't apply crop immediately
    drawCropOverlay();
  } else {
    endCropMode();
  }
}

function getResizeHandle(x, y) {
  const handleSize = 10;
  const handles = [
    { name: 'nw', cursor: 'nwse-resize', x: cropStart.x, y: cropStart.y },
    { name: 'ne', cursor: 'nesw-resize', x: cropEnd.x, y: cropStart.y },
    { name: 'sw', cursor: 'nesw-resize', x: cropStart.x, y: cropEnd.y },
    { name: 'se', cursor: 'nwse-resize', x: cropEnd.x, y: cropEnd.y },
    { name: 'n', cursor: 'ns-resize', x: (cropStart.x + cropEnd.x) / 2, y: cropStart.y },
    { name: 's', cursor: 'ns-resize', x: (cropStart.x + cropEnd.x) / 2, y: cropEnd.y },
    { name: 'w', cursor: 'ew-resize', x: cropStart.x, y: (cropStart.y + cropEnd.y) / 2 },
    { name: 'e', cursor: 'ew-resize', x: cropEnd.x, y: (cropStart.y + cropEnd.y) / 2 }
  ];

  for (const handle of handles) {
    if (Math.abs(x - handle.x) <= handleSize / 2 && Math.abs(y - handle.y) <= handleSize / 2) {
      return handle;
    }
  }
  return null;
}

function resizeCropArea(x, y) {
  switch (resizeHandle) {
    case 'nw':
      cropStart.x = x;
      cropStart.y = y;
      break;
    case 'ne':
      cropEnd.x = x;
      cropStart.y = y;
      break;
    case 'sw':
      cropStart.x = x;
      cropEnd.y = y;
      break;
    case 'se':
      cropEnd.x = x;
      cropEnd.y = y;
      break;
    case 'n':
      cropStart.y = y;
      break;
    case 's':
      cropEnd.y = y;
      break;
    case 'w':
      cropStart.x = x;
      break;
    case 'e':
      cropEnd.x = x;
      break;
  }
}

// Modify the drawCropOverlay function
function drawCropOverlay() {
  // Clear the main canvas
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  
  // Draw the original image
  ctx.drawImage(originalCanvas, 0, 0);

  // If a selection has been made
  if (cropStart.x !== cropEnd.x && cropStart.y !== cropEnd.y) {
    // Calculate crop dimensions
    const cropWidth = Math.abs(cropEnd.x - cropStart.x);
    const cropHeight = Math.abs(cropEnd.y - cropStart.y);
    const cropX = Math.min(cropStart.x, cropEnd.x);
    const cropY = Math.min(cropStart.y, cropEnd.y);

    // Create a dark overlay for the entire canvas
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Clear the selected area to show the original image
    ctx.clearRect(cropX, cropY, cropWidth, cropHeight);
    
    // Redraw the selected portion of the original image (in case clearRect affected it)
    ctx.drawImage(
      originalCanvas, 
      cropX, cropY, cropWidth, cropHeight,
      cropX, cropY, cropWidth, cropHeight
    );
    
    // Draw a border around the selected area
    ctx.strokeStyle = 'white';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);
    ctx.strokeRect(cropX, cropY, cropWidth, cropHeight);

    // Draw corner and edge handles
    const handleSize = 10;
    ctx.fillStyle = 'white';
    [
      [cropX, cropY], [cropX + cropWidth, cropY], 
      [cropX, cropY + cropHeight], [cropX + cropWidth, cropY + cropHeight],
      [cropX + cropWidth/2, cropY], [cropX + cropWidth/2, cropY + cropHeight],
      [cropX, cropY + cropHeight/2], [cropX + cropWidth, cropY + cropHeight/2]
    ].forEach(([x, y]) => ctx.fillRect(x - handleSize/2, y - handleSize/2, handleSize, handleSize));

    // Draw dimensions text
    ctx.font = '14px Arial';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    const dimensionsText = `${Math.round(cropWidth)} x ${Math.round(cropHeight)}`;
    let textX = cropX + 5;
    let textY = cropY + 5;
    
    // Adjust text position if too close to canvas edge
    if (textX + ctx.measureText(dimensionsText).width > canvas.width) textX = cropX + cropWidth - ctx.measureText(dimensionsText).width - 5;
    if (textY < 5) textY = 5;

    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(textX - 2, textY - 2, ctx.measureText(dimensionsText).width + 4, 20);
    ctx.fillStyle = 'white';
    ctx.fillText(dimensionsText, textX, textY);
  } else {
    // If no selection, just draw a semi-transparent overlay over the entire canvas
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
}

async function uploadToWalrus(blob) {
  const formData = new FormData();
  formData.append('file', blob, 'screenshot.png');
  
  try {
<<<<<<< HEAD
    const response = await axios.put(`${WALRUS_PUBLISHER}/v1/store?epochs=5`, formData, {
=======
    const response = await axios.put(`${WALRUS_PUBLISHER}/v1/store?epochs=1`, formData, {
>>>>>>> 1e693ed (snapsafe project)
      headers: { 'Content-Type': 'multipart/form-data' }
    });

    if (response.status === 200) {
      return response.data.newlyCreated.blobObject.blobId;
    } else {
      throw new Error('Failed to upload to Walrus');
    }
  } catch (error) {
    console.error('Error uploading to Walrus:', error);
    throw error;
  }
}

function showNotification(message) {
  const notification = document.createElement('div');
  notification.textContent = message;
  notification.style.position = 'fixed';
  notification.style.bottom = '20px';
  notification.style.right = '20px';
  notification.style.padding = '10px';
  notification.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
  notification.style.color = 'white';
  notification.style.borderRadius = '5px';
  notification.style.zIndex = '1000';
  document.body.appendChild(notification);

  setTimeout(() => {
    document.body.removeChild(notification);
  }, 3000);
}


// Add this function to ensure crop coordinates are within canvas bounds
function constrainCropToCanvas() {
  cropStart.x = Math.max(0, Math.min(cropStart.x, canvas.width));
  cropStart.y = Math.max(0, Math.min(cropStart.y, canvas.height));
  cropEnd.x = Math.max(0, Math.min(cropEnd.x, canvas.width));
  cropEnd.y = Math.max(0, Math.min(cropEnd.y, canvas.height));
}


function initializeCropTool() {
  const cropButton = document.getElementById('crop-button');
  cropButton.addEventListener('click', () => {
    setTool('CROP');
    isCropping = false;
    canvas.style.cursor = 'crosshair';
  });
}

async function uploadScreenshot(imageDataURL, retries = 3, delay = 1000) {
  const now = Date.now();
  if (now - lastUploadTime < COOLDOWN_PERIOD) {
    const waitTime = Math.ceil((COOLDOWN_PERIOD - (now - lastUploadTime)) / 1000);
    throw new Error(`Please wait ${waitTime} seconds before uploading again.`);
  }

  try {
    const response = await axios({
      method: 'post',
      url: 'https://api.imgur.com/3/image',
      headers: { Authorization: `Client-ID ${imgurClientId}` },
      data: { image: imageDataURL, type: 'base64' }
    });
    lastUploadTime = Date.now();
    return response.data.data.link;
  } catch (error) {
    if (error.response && error.response.status === 429 && retries > 0) {
      console.log(`Rate limited. Retrying in ${delay/1000} seconds...`);
      await new Promise(resolve => setTimeout(resolve, delay));
      return uploadScreenshot(imageDataURL, retries - 1, delay * 2);
    }
    throw error;
  }
}

async function uploadAndShareScreenshot() {
  if (!canvas) {
    console.error('Canvas not initialized');
    alert('Error: Canvas not initialized');
    return;
  }

  const imageDataURL = canvas.toDataURL('image/png').split(',')[1];

  try {
    const shareLink = await uploadScreenshot(imageDataURL);
    console.log('Screenshot uploaded successfully. Share link:', shareLink);
    showShareLink(shareLink);
  } catch (error) {
    console.error('Error uploading screenshot:', error);
    if (error.message.includes('Please wait')) {
      alert(error.message);
    } else {
      const saveLocally = confirm('Upload failed. Would you like to save the screenshot locally?');
      if (saveLocally) {
        await saveScreenshotLocally();
      }
    }
  }
}

async function saveScreenshotLocally() {
  try {
    await saveScreenshot(false); // Use the existing saveScreenshot function
    alert('Screenshot saved locally successfully.');
  } catch (error) {
    console.error('Error saving screenshot locally:', error);
    alert('Failed to save screenshot locally. Please try again.');
  }
}

function handleReopen() {
  // Reinitialize the app state if necessary
  initializeCanvas();
  // You might want to show a message or perform any other initialization here
}

async function saveScreenshot(uploadToPinata = false) {
  if (!canvas) {
    console.error('Canvas not initialized');
    alert('Error: Canvas not initialized');
    return;
  }

  const imageDataURL = canvas.toDataURL('image/png');

  try {
    const result = await ipcRenderer.invoke('save-screenshot', imageDataURL, uploadToPinata);
    if (result.success) {
      console.log('Screenshot saved successfully:', result.filePath);
      if (result.pinataUrl) {
        console.log('Screenshot uploaded to Pinata:', result.pinataUrl);
        showShareLink(result.pinataUrl);
      } else {
        alert('Screenshot saved successfully!');
      }
    } else if (result.canceled) {
      console.log('Save operation was canceled by the user');
    } else {
      console.error('Failed to save screenshot:', result.error);
      alert('Failed to save screenshot. Please try again.');
    }
  } catch (error) {
    console.error('Error saving screenshot:', error);
    alert('An error occurred while saving the screenshot. Please try again.');
  }
}

// Listen for the 'app-reopen' event from the main process
ipcRenderer.on('app-reopen', handleReopen);

function showShareLink(link, type = 'Pinata') {
  const modal = document.createElement('div');
  modal.style.position = 'fixed';
  modal.style.left = '0';
  modal.style.top = '0';
  modal.style.width = '100%';
  modal.style.height = '100%';
  modal.style.backgroundColor = 'rgba(0,0,0,0.5)';
  modal.style.display = 'flex';
  modal.style.justifyContent = 'center';
  modal.style.alignItems = 'center';

  const content = document.createElement('div');
  content.style.backgroundColor = 'white';
  content.style.padding = '20px';
  content.style.borderRadius = '5px';
  content.innerHTML = `
<<<<<<< HEAD
    <h3>Share your screenshot</h3>
    <p>Your screenshot has been uploaded to ${type}. ${type === 'Walrus' ? 'Use this Blob ID:' : 'Share it using this link:'}</p>
    <input type="text" value="${link}" readonly style="width: 100%; margin-bottom: 10px;">
    <button id="copyLinkBtn">Copy ${type === 'Walrus' ? 'Blob ID' : 'Link'}</button>
    <button id="closeModalBtn">Close</button>
=======
<h3>Share your screenshot</h3>
<p>Your screenshot has been uploaded to ${type}. ${type === 'Walrus' ? 'Use this Blob ID:' : 'Share it using this link:'}</p>
<input type="text" value="${link}" readonly style="width: 100%; margin-bottom: 10px;">
<button id="copyLinkBtn">Copy ${type === 'Walrus' ? 'Blob ID' : 'Link'}</button>
<button id="viewOnWalrusBtn" onclick="window.open('https://display.walrus.site/?blobId=vgcOdZdUbvC_DNZ9qKe8wmyZN0bNwVCGmoGvgeHLpGw', '_blank')">View on Walrus</button>
<button id="closeModalBtn">Close</button>
>>>>>>> 1e693ed (snapsafe project)
  `;

  modal.appendChild(content);
  document.body.appendChild(modal);

  document.getElementById('copyLinkBtn').addEventListener('click', () => {
    navigator.clipboard.writeText(link).then(() => {
      alert(`${type === 'Walrus' ? 'Blob ID' : 'Link'} copied to clipboard!`);
    });
  });

  document.getElementById('closeModalBtn').addEventListener('click', () => {
    document.body.removeChild(modal);
  });
}

document.addEventListener('DOMContentLoaded', () => {
 // checkWalrusDaemon();
  initializeCanvas();
  ipcRenderer.on('load-screenshot', (event, imagePath) => {
    console.log('Received screenshot path:', imagePath);
    loadScreenshot(imagePath);
  });
  document.getElementById('colorPicker').addEventListener('change', (event) => {
    changeColor(event.target.value);
  });

  // Add a line width picker if you haven't already
  const lineWidthPicker = document.getElementById('lineWidthPicker');
  if (lineWidthPicker) {
    lineWidthPicker.addEventListener('change', (event) => {
      changeLineWidth(parseInt(event.target.value));
    });
  }
  // Update the close button event listener
  const closeButton = document.getElementById('close-button');
  if (closeButton) {
    closeButton.addEventListener('click', () => {
      clearCanvas();
      ipcRenderer.send('hide-window');
    });
  }
  document.getElementById('undo-button').addEventListener('click', () => {
    undo(ctx, undoStack);
  });

  document.getElementById('save-button').addEventListener('click', saveScreenshot);

  initializeCropTool();

  const shareButton = document.createElement('button');
  shareButton.textContent = 'Share Screenshot';
  shareButton.addEventListener('click', uploadAndShareScreenshot);
  document.getElementById('toolbar').appendChild(shareButton);

  document.getElementById('save-button').addEventListener('click', () => saveScreenshot(false));
  document.getElementById('upload-to-walrus-button').addEventListener('click', async () => {
    if (!canvas) {
      console.error('Canvas not initialized');
      alert('Error: Canvas not initialized');
      return;
    }
  
    try {
      console.log('Uploading to Walrus');
      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
      console.log('Blob created:', blob);
      const blobId = await uploadToWalrus(blob);
      console.log('Screenshot uploaded to Walrus:', blobId);
      showShareLink(blobId, 'Walrus');
    } catch (error) {
      console.error('Error uploading to Walrus:', error);
      alert('An error occurred while uploading to Walrus. Please try again.');
    }
  });
<<<<<<< HEAD
  document.getElementById('read-from-walrus-button').addEventListener('click', async () => {
    // Log the button click event
    console.log('Button clicked. Attempting to read from Walrus...');
  
    const blobId = document.getElementById('blob-id-input').value; // Get value from input
    if (!blobId) {
      console.warn('No Blob ID entered. Exiting function.');
      return; // Exit if no Blob ID is provided
    }
  
    try {
      console.log(`Reading blob from Walrus with ID: ${blobId}`);
      const blob = await readFromWalrus(blobId);
  
      if (!blob || !blob.type.startsWith('image/')) {
        console.error('Invalid blob received or unsupported format.');
        throw new Error('Invalid blob or unsupported format.');
      }
  
      console.log('Blob successfully retrieved. Creating image...');
      const img = new Image();
      img.onload = function() {
        console.log('Image loaded. Setting canvas dimensions...');
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);
        resizeCanvas();
        URL.revokeObjectURL(img.src); // Clean up memory
        console.log('Image drawn on canvas and memory cleaned up.');
      };
  
      img.src = URL.createObjectURL(blob);
    } catch (error) {
      console.error('Error reading from Walrus:', error);
      alert('An error occurred while reading from Walrus. Please try again.');
    }
  });
=======
  // document.getElementById('read-from-walrus-button').addEventListener('click', async () => {
  //   // Log the button click event
  //   console.log('Button clicked. Attempting to read from Walrus...');
  
  //   const blobId = document.getElementById('blob-id-input').value; // Get value from input
  //   if (!blobId) {
  //     console.warn('No Blob ID entered. Exiting function.');
  //     return; // Exit if no Blob ID is provided
  //   }
  
  //   try {
  //     console.log(`Reading blob from Walrus with ID: ${blobId}`);
  //     const blob = await readFromWalrus(blobId);
  
  //     if (!blob || !blob.type.startsWith('image/')) {
  //       console.error('Invalid blob received or unsupported format.');
  //       throw new Error('Invalid blob or unsupported format.');
  //     }
  
  //     console.log('Blob successfully retrieved. Creating image...');
  //     const img = new Image();
  //     img.onload = function() {
  //       console.log('Image loaded. Setting canvas dimensions...');
  //       canvas.width = img.width;
  //       canvas.height = img.height;
  //       ctx.drawImage(img, 0, 0);
  //       resizeCanvas();
  //       URL.revokeObjectURL(img.src); // Clean up memory
  //       console.log('Image drawn on canvas and memory cleaned up.');
  //     };
  
  //     img.src = URL.createObjectURL(blob);
  //   } catch (error) {
  //     console.error('Error reading from Walrus:', error);
  //     alert('An error occurred while reading from Walrus. Please try again.');
  //   }
  // });
>>>>>>> 1e693ed (snapsafe project)
  
  
  // Add a new button for Pinata upload
  const savePinataButton = document.createElement('button');
  savePinataButton.textContent = 'Save & Upload to Pinata';
  savePinataButton.addEventListener('click', () => saveScreenshot(true));
  document.getElementById('toolbar').appendChild(savePinataButton);

    // Show notification about the new shortcut
    showNotification('Press Ctrl+Shift+S (Cmd+Shift+S on Mac) to take a screenshot at any time');

});

function clearCanvas() {
  if (canvas && ctx) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    canvas.width = 0;
    canvas.height = 0;
    undoStack = [];
  }
}

ipcRenderer.on('clear-canvas', () => {
  clearCanvas();
});

ipcRenderer.on('screenshot-loaded', (event, filePath) => {
  clearCanvas(); // Clear the canvas before loading a new screenshot
  const img = new Image();
  img.src = filePath;

  img.onload = function () {
    canvas = document.getElementById('screenshot-canvas');
    
    if (canvas) {
      ctx = canvas.getContext('2d');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      initializeCanvas();
      resizeCanvas();
    } else {
      console.error('Canvas element not found');
    }
  };
});

window.addEventListener('load', resizeCanvas);