export class PointerInput {
  constructor(canvas, toWorld) {
    this.canvas = canvas;
    this.toWorld = toWorld;
    this.active = false;
    this.target = null;
    this.offset = { x: 0, y: 0 };
    this.bind();
  }

  bind() {
    this.canvas.addEventListener('pointerdown', (event) => {
      this.active = true;
      this.canvas.setPointerCapture(event.pointerId);
      this.target = this.toWorld(event);
      this.offset = { x: 0, y: -34 };
    });
    this.canvas.addEventListener('pointermove', (event) => {
      if (!this.active) return;
      const point = this.toWorld(event);
      this.target = {
        x: point.x + this.offset.x,
        y: point.y + this.offset.y
      };
    });
    this.canvas.addEventListener('pointerup', () => this.end());
    this.canvas.addEventListener('pointercancel', () => this.end());
  }

  end() {
    this.active = false;
    this.target = null;
  }
}
