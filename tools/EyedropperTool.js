function handleEyedropperTool(canvas, ctx, event) {
  const endX = event.offsetX;
  const endY = event.offsetY;
  const pixelData = ctx.getImageData(endX, endY, 1, 1).data;
  const color = `rgba(${pixelData[0]}, ${pixelData[1]}, ${pixelData[2]}, ${pixelData[3] / 255})`;

  // Convert RGBA to HEX
  const hexColor = rgbToHex(pixelData[0], pixelData[1], pixelData[2]);

  ctx.strokeStyle = color;
  ctx.fillStyle = color;

  // Update color picker
  document.getElementById('colorPicker').value = hexColor;
  alert(`Picked Color: ${color}`);
}

function rgbToHex(r, g, b) {
  return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1).toUpperCase();
}

module.exports = { handleEyedropperTool };
