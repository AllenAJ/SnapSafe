function changeColor(color) {
  currentColor = color;
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
}

function changeLineWidth(width) {
  currentLineWidth = width;
  ctx.lineWidth = width;
}

function rgbToHex(r, g, b) {
  return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1).toUpperCase();
}

module.exports = { changeColor, rgbToHex, changeLineWidth };
