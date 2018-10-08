import { computeDiff } from "./canvas_diff";
import { TextBuffer } from "./text_buffer";
import * as xterm256 from "./xterm256";

const WHITE = 7; // xterm256.get_color("gray");
const BLACK = 0; // xterm256.get_color("black");

const SPACE = 0x20;


export class Canvas {
  // next: what we're drawing
  nextBuffer: TextBuffer;
  // current: what's currently on the screen
  currentBuffer: TextBuffer;

  constructor(public cols: number, public rows: number) {
    this.nextBuffer = new TextBuffer(cols, rows);
    this.currentBuffer = new TextBuffer(cols, rows);
    this.nextBuffer.clearBox(0, 0, cols, rows, (BLACK << 8) | WHITE);
    this.currentBuffer.set(this.nextBuffer);
    this.currentBuffer.attr = -1;
  }

  all(): Region {
    return new Region(this, 0, 0, this.cols, this.rows);
  }

  clip(x1: number, y1: number, x2: number, y2: number): Region {
    x1 = Math.max(0, Math.min(x1, this.cols));
    x2 = Math.max(0, Math.min(x2, this.cols));
    y1 = Math.max(0, Math.min(y1, this.rows));
    y2 = Math.max(0, Math.min(y2, this.rows));
    return new Region(this, Math.max(x1, 0), y1, x2, y2);
  }

  write(x: number, y: number, attr: number, s: string) {
    for (let i = 0; i < s.length; i++) {
      const ch = s.codePointAt(i) || SPACE;
      if (ch > 0xffff) i++;
      this.nextBuffer.put(x++, y, attr, ch);
      if (x >= this.cols || y >= this.rows) return;
    }
  }

  paint(): string {
    return computeDiff(this.currentBuffer, this.nextBuffer);
  }
}


// Clipped region of a canvas
export class Region {
  public cursorX: number;
  public cursorY: number;
  public attr: number;

  constructor(
    public canvas: Canvas,
    public x1: number,
    public y1: number,
    public x2: number,
    public y2: number
  ) {
    this.cursorX = 0;
    this.cursorY = 0;
    this.attr = (BLACK << 8) | WHITE;
  }

  all(): Region {
    return this;
  }

  clip(x1: number, y1: number, x2: number, y2: number): Region {
    x1 = Math.max(this.x1, Math.min(x1, this.x2));
    x2 = Math.max(this.x1, Math.min(x2, this.x2));
    y1 = Math.max(this.y1, Math.min(y1, this.y2));
    y2 = Math.max(this.y1, Math.min(y2, this.y2));
    return new Region(this.canvas, x1, y1, x2, y2);
  }

  color(fg?: string | number, bg?: string | number): this {
    if (fg) {
      const attr = (typeof fg === "string") ? xterm256.get_color(fg) : fg;
      this.attr = (this.attr & 0xff00) | attr;
    }
    if (bg) {
      const attr = (typeof bg === "string") ? xterm256.get_color(bg) : bg;
      this.attr = (this.attr & 0xff) | (attr << 8);
    }
    return this;
  }

  at(x: number, y: number): this {
    this.cursorX = Math.max(Math.min(x, this.x2 - this.x1), 0);
    this.cursorY = Math.max(Math.min(y, this.y2 - this.y1), 0);
    return this;
  }

  clear(): this {
    this.canvas.nextBuffer.clearBox(this.x1, this.y1, this.x2, this.y2, this.attr);
    return this;
  }

  write(s: string): this {
    while (s.length > 0) {
      // check for auto-scroll, only when we need to write another glyph
      if (this.cursorX >= this.x2 - this.x1) {
        this.cursorX = 0;
        this.cursorY++;
        if (this.cursorY >= this.y2 - this.y1) {
          this.scrollUp();
          this.cursorY = this.y2 - this.y1 - 1;
        }
      }

      const n = this.x2 - this.x1 - this.cursorX;
      const text = s.slice(0, n);
      this.canvas.write(this.cursorX, this.cursorY, this.attr, text);
      this.cursorX += text.length;
      s = s.slice(n);
    }

    return this;
  }

  clearToEndOfLine(): this {
    this.canvas.nextBuffer.clearToEndOfLine(this.cursorX, this.cursorY, this.attr);
    return this;
  }

  scrollUp(rows: number = 1): this {
    this.canvas.nextBuffer.scrollUp(this.x1, this.y1, this.x2, this.y2, rows, this.attr);
    return this;
  }

  scrollDown(rows: number = 1): this {
    this.canvas.nextBuffer.scrollDown(this.x1, this.y1, this.x2, this.y2, rows, this.attr);
    return this;
  }

  scrollLeft(cols: number = 1): this {
    this.canvas.nextBuffer.scrollLeft(this.x1, this.y1, this.x2, this.y2, cols, this.attr);
    return this;
  }

  scrollRight(cols: number = 1): this {
    this.canvas.nextBuffer.scrollRight(this.x1, this.y1, this.x2, this.y2, cols, this.attr);
    return this;
  }
}
