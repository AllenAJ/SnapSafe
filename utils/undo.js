function saveState(ctx, undoStack, canvas) {
  if (ctx) {
    undoStack.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
  } else {
    console.error("Canvas context is not defined.");
  }
}

function undo(ctx, undoStack) {
  if (undoStack.length > 0 && ctx) {
    const previousState = undoStack.pop();
    ctx.putImageData(previousState, 0, 0);
  }
}

module.exports = { saveState, undo };
