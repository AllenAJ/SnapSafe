class DrawingTool {
    constructor() {
      this.drawingColor = 'black';
      this.drawingStrokeThickness = 2;
    }
  
    // This is an abstract method that should be implemented by subclasses
    onMouseDown(event) {
      throw new Error('onMouseDown() should be implemented by subclass');
    }
  
    onMouseMove(event) {
      throw new Error('onMouseMove() should be implemented by subclass');
    }
  
    onMouseUp(event) {
      throw new Error('onMouseUp() should be implemented by subclass');
    }
  
    // Optionally, other methods like updating stroke thickness can be added
  }
  
  module.exports = DrawingTool;  // Exporting the base class
  