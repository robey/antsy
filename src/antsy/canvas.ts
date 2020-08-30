import { computeDiff } from "./canvas_diff";
import { Terminal } from "./terminal";
import { TextBuffer } from "./text_buffer";
import * as xterm256 from "./xterm256";

const WHITE = 7; // xterm256.get_color("gray");
const BLACK = 0; // xterm256.get_color("black");

const SPACE = 0x20;


export class Canvas {
  // next: what we're drawing
  nextBuffer: TextBuffer;
  // current: what's currently on the screen
  currentBuffer?: TextBuffer;

  constructor(public cols: number, public rows: number) {
    this.nextBuffer = new TextBuffer(cols, rows);
    this.currentBuffer = new TextBuffer(cols, rows);
    this.nextBuffer.clearBox(0, 0, cols, rows, (BLACK << 8) | WHITE);
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
    this.writeChars(x, y, attr, [...s]);
  }

  writeChars(x: number, y: number, attr: number, chars: string[]) {
    for (let i = 0; i < chars.length; i++) {
      const ch = chars[i].codePointAt(0) ?? SPACE;
      this.nextBuffer.put(x++, y, attr, ch);
      if (x >= this.cols || y >= this.rows) return;
    }
  }

  paint(): string {
    // don't create currentBuffer unless they actually call paint
    if (this.currentBuffer === undefined) this.currentBuffer = new TextBuffer(this.cols, this.rows);
    return computeDiff(this.currentBuffer, this.nextBuffer);
  }

  // generate linefeed-terminated lines of text, assuming we don't own the
  // screen, so we can't move the cursor and have to output every char.
  paintInline(): string {
    return [...Array(this.nextBuffer.rows).keys()].map(y => {
      let line = "";
      let fg = -1, bg = -1;

      for (let x = 0; x < this.nextBuffer.cols; x++) {
        const attr = this.nextBuffer.getAttr(x, y);
        if ((attr >> 8) != bg) line += Terminal.bg(attr >> 8);
        if ((attr & 0xff) != fg) line += Terminal.fg(attr & 0xff);
        line += String.fromCodePoint(this.nextBuffer.getChar(x, y));
        fg = attr & 0xff;
        bg = attr >> 8;
      }

      line += Terminal.noColor() + "\n";
      return line;
    }).join("");
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

  get cols(): number {
    return this.x2 - this.x1;
  }

  get rows(): number {
    return this.y2 - this.y1;
  }

  all(): Region {
    const r = new Region(this.canvas, 0, 0, this.canvas.cols, this.canvas.rows);
    r.cursorX = this.cursorX + this.x1;
    r.cursorY = this.cursorY + this.y1;
    r.attr = this.attr;
    return r;
  }

  clip(x1: number, y1: number, x2: number, y2: number): Region {
    x1 = Math.max(this.x1, Math.min(this.x1 + x1, this.x2));
    x2 = Math.max(this.x1, Math.min(this.x1 + x2, this.x2));
    y1 = Math.max(this.y1, Math.min(this.y1 + y1, this.y2));
    y2 = Math.max(this.y1, Math.min(this.y1 + y2, this.y2));
    const r = new Region(this.canvas, x1, y1, x2, y2);
    r.cursorX = this.cursorX;
    r.cursorY = this.cursorY;
    r.attr = this.attr;
    return r;
  }

  color(fg?: string | number, bg?: string | number): this {
    if (fg !== undefined) {
      const attr = (typeof fg === "string") ? xterm256.get_color(fg) : fg;
      this.attr = (this.attr & 0xff00) | attr;
    }
    if (bg !== undefined) {
      const attr = (typeof bg === "string") ? xterm256.get_color(bg) : bg;
      this.attr = (this.attr & 0xff) | (attr << 8);
    }
    return this;
  }

  backgroundColor(bg: string | number): this {
    return this.color(undefined, bg);
  }

  at(x: number, y: number): this {
    this.cursorX = Math.max(Math.min(x, this.cols), 0);
    this.cursorY = Math.max(Math.min(y, this.rows), 0);
    return this;
  }

  clear(): this {
    this.canvas.nextBuffer.clearBox(this.x1, this.y1, this.x2, this.y2, this.attr);
    return this;
  }

  write(s: string): this {
    let chars = [...s];
    while (chars.length > 0) {
      // check for auto-scroll, only when we need to write another glyph
      if (this.cursorX >= this.cols) {
        this.cursorX = 0;
        this.cursorY++;
        if (this.cursorY >= this.rows) {
          this.scrollUp();
          this.cursorY = this.rows - 1;
        }
      }

      const n = this.cols - this.cursorX;
      const slice = chars.slice(0, n);
      this.canvas.writeChars(this.x1 + this.cursorX, this.y1 + this.cursorY, this.attr, slice);
      this.cursorX += slice.length;
      chars = chars.slice(slice.length);
    }

    return this;
  }

  draw(other: Region): this {
    const maxx = this.cols - this.cursorX, maxy = this.rows - this.cursorY;
    if (other.cols > maxx || other.rows > maxy) other = other.clip(0, 0, maxx, maxy);
    this.canvas.nextBuffer.putBox(this.x1, this.y1, other.canvas.nextBuffer, other.x1, other.y1, other.x2, other.y2);
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

  moveCursor(x: number = this.cursorX, y: number = this.cursorY): this {
    this.canvas.nextBuffer.cursorX = x;
    this.canvas.nextBuffer.cursorY = y;
    return this;
  }
}
