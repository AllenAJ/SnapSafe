function createTextInput(canvas, ctx, x, y) {
  // Get the canvas's offset relative to the page
  const canvasRect = canvas.getBoundingClientRect();

  // Create an input element for text
  const input = document.createElement('input');
  input.type = 'text';
  input.style.position = 'absolute';
  input.style.left = `${Math.floor(canvasRect.left + x)}px`;
  input.style.top = `${Math.floor(canvasRect.top + y)}px`;
  input.style.fontSize = '20px';
  input.style.color = ctx.strokeStyle;  // Match the color of the input text with the current stroke color
  input.style.border = 'none';
  input.style.background = 'transparent';
  input.style.outline = 'none';
  input.style.fontFamily = 'Arial';

  // Ensure input is added to the DOM before focus
  document.body.appendChild(input);

  // Focus the input element and ensure it can receive input
  setTimeout(() => {
    input.focus();
  }, 0);

  // Add event listener for Enter key
  input.addEventListener('keydown', function (event) {
    if (event.key === 'Enter') {
      event.preventDefault();  // Prevent Enter from being added to the input value
      finalizeText(input, ctx, x, y, canvas);  // Finalize the text and remove the input
    }
  });

  // Add blur event listener to finalize text when input loses focus
  input.addEventListener('blur', function () {
    finalizeText(input, ctx, x, y, canvas);  // Finalize the text when focus is lost
  });

  // Log position for debugging purposes
  console.log(`Input created at: (${input.style.left}, ${input.style.top})`);
}

function finalizeText(input, ctx, x, y, canvas) {
  // Get the actual input field's position after it's placed
  const inputRect = input.getBoundingClientRect();

  // Capture the input value for debugging purposes
  const textValue = input.value.trim();
  console.log(`Finalizing text: "${textValue}"`);

  // Check if the input value is empty before drawing on canvas
  if (textValue === '') {
    console.warn('No text entered, skipping drawing on canvas.');
    document.body.removeChild(input);  // Remove the input field
    return;
  }

  // Save the current canvas state before drawing the text (for undo)
  saveState(ctx, undoStack, canvas);

  // Set text alignment and baseline
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';  // Use 'top' to match the input field alignment

  // Calculate the coordinates relative to the canvas
  const relX = inputRect.left - canvas.getBoundingClientRect().left;
  const relY = inputRect.top - canvas.getBoundingClientRect().top;

  // Draw the text on the canvas at the exact position where the input was
  ctx.font = '20px Arial';
  ctx.fillStyle = ctx.strokeStyle;  // Use the current stroke color
  ctx.fillText(textValue, relX, relY);  // Draw the text on the canvas

  console.log(`Text drawn at (${relX}, ${relY}) on canvas.`);

  // Remove the input element after drawing the text
  document.body.removeChild(input);

  console.log('Text finalized and input removed.');
}


module.exports = { createTextInput };
