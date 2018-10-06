import { computeDiff } from "./canvas_diff";
import { Terminal } from "./terminal";
import { TextBuffer } from "./text_buffer";
import * as xterm256 from "./xterm256";

const SPACE = 0x20;


export class Canvas {
  // next: what we're drawing
  private nextBuffer: TextBuffer;
  // current: what's currently on the screen
  private currentBuffer: TextBuffer;

  constructor(public cols: number, public rows: number) {
    this.nextBuffer = new TextBuffer(cols, rows);
    this.currentBuffer = new TextBuffer(cols, rows);
    this.clear();
    this.currentBuffer.set(this.nextBuffer);
    this.currentBuffer.attr = -1;
  }

  // reset entire screen to blank, with the current fg/bg color
  clear() {
    this.nextBuffer.clear();
  }

  color(fg?: string | number, bg?: string | number): this {
    if (fg) {
      const attr = (typeof fg === "string") ? xterm256.get_color(fg) : fg;
      this.nextBuffer.attr = (this.nextBuffer.attr & 0xff00) | attr;
    }
    if (bg) {
      const attr = (typeof bg === "string") ? xterm256.get_color(bg) : bg;
      this.nextBuffer.attr = (this.nextBuffer.attr & 0xff) | (attr << 8);
    }
    return this;
  }

  at(x: number, y: number): this {
    this.nextBuffer.cursorX = Math.max(Math.min(x, this.cols - 1), 0);
    this.nextBuffer.cursorY = Math.max(Math.min(y, this.rows - 1), 0);
    return this;
  }

  write(s: string): this {
    for (let i = 0; i < s.length; i++) {
      const ch = s.codePointAt(i) || SPACE;
      if (ch > 0xffff) i++;
      this.nextBuffer.put(this.nextBuffer.cursorX, this.nextBuffer.cursorY, this.nextBuffer.attr, ch);
      this.nextBuffer.cursorX++;
      if (this.nextBuffer.cursorX >= this.cols) {
        this.nextBuffer.cursorX = 0;
        this.nextBuffer.cursorY++;
        if (this.nextBuffer.cursorY >= this.rows) {
          // FIXME
          this.nextBuffer.cursorY = 0;
        }
      }
    }
    return this;
  }

  clearToEndOfLine(): this {
    this.nextBuffer.clearToEndOfLine(this.nextBuffer.cursorX, this.nextBuffer.cursorY);
    return this;
  }

  scrollUp(x1: number, y1: number, x2: number, y2: number, rows: number): this {
    this.nextBuffer.scrollUp(x1, y1, x2, y2, rows);
    return this;
  }

  scrollDown(x1: number, y1: number, x2: number, y2: number, rows: number): this {
    this.nextBuffer.scrollDown(x1, y1, x2, y2, rows);
    return this;
  }

  scrollLeft(x1: number, y1: number, x2: number, y2: number, cols: number): this {
    this.nextBuffer.scrollLeft(x1, y1, x2, y2, cols);
    return this;
  }

  scrollRight(x1: number, y1: number, x2: number, y2: number, cols: number): this {
    this.nextBuffer.scrollRight(x1, y1, x2, y2, cols);
    return this;
  }

  paint(): string {
    return computeDiff(this.currentBuffer, this.nextBuffer);
  }
}
