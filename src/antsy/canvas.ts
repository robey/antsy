import * as xterm256 from "./xterm256";

const SPACE = " ".charCodeAt(0);

const UNDERLINE_START = "\u001b[4m";
const UNDERLINE_STOP = "\u001b[24m";
export const RESET_ATTRIBUTES = "\u001b[0m";

function fgString(index: number): string { return `\u001b[38;5;${index}m`; }
function bgString(index: number): string { return `\u001b[48;5;${index}m`; }

export const TRANSPARENT = -1;
const WHITE = xterm256.get_color("white");
const BLACK = xterm256.get_color("black");

export class Canvas {
  private grid: number[];
  private x: number;
  private y: number;
  private fg: number;
  private bg: number;

  constructor(public width: number, public height: number) {
    // (y, x) indexed, with each entry: BBFFCCCCC
    // (B = bg color, F = fg color, C = 20-bit unichar)
    this.grid = new Array(this.width * this.height);
    this.fg = WHITE;
    this.bg = BLACK;
    this.clear();
    this.y = 0;
    this.x = 0;
  }

  color(c: string | number): this {
    this.fg = typeof c === "string" ? xterm256.get_color(c) : c;
    return this;
  }

  backgroundColor(c: string | number): this {
    this.bg = typeof c === "string" ? xterm256.get_color(c) : c;
    return this;
  }

  at(x: number, y: number): this {
    this.x = x;
    this.y = y;
    return this;
  }

  write(s: string): this {
    for (let i = 0; i < s.length; i++) {
      this._put(this.x, this.y, this.bg, this.fg, s[i]);
      this.x += 1;
      if (this.x >= this.width) {
        this.x = 0;
        this.y += 1;
        if (this.y >= this.height) {
          this.y = 0;
        }
      }
    }
    return this;
  }

  clear(): this {
    this.fillBackground(this.bg == TRANSPARENT ? BLACK : this.bg);
    return this;
  }

  scroll(deltaX: number, deltaY: number): this {
    const directionX = deltaX < 0 ? -1 : 1;
    const directionY = deltaY < 0 ? -1 : 1;
    const absX = Math.abs(deltaX);
    const absY = Math.abs(deltaY);

    const bg = this.bg == TRANSPARENT ? BLACK : this.bg;
    const blank = bg * Math.pow(2, 28) + SPACE;

    if (absX >= this.width || absY >= this.height) {
      this.clear();
      return this;
    }

    const destX = directionX > 0 ? 0 : absX;
    const sourceX = directionX > 0 ? absX : 0;
    const widthX = this.width - absX;
    for (let i = 0; i < this.height - absY; i++) {
      const destY = directionY > 0 ? i : this.height - i - 1;
      const destIndex = destY * this.width + destX;
      const sourceY = destY + deltaY;
      const sourceIndex = sourceY * this.width + sourceX;
      // splice is dog-slow here! :(
      if (directionX > 0) {
        for (let j = 0; j < widthX; j++) this.grid[destIndex + j] = this.grid[sourceIndex + j];
      } else {
        for (let j = widthX - 1; j >= 0; j--) this.grid[destIndex + j] = this.grid[sourceIndex + j];
      }
    }

    // pad vertical
    for (let i = 0; i < absY; i++) {
      const y = directionY > 0 ? this.height - i - 1 : i;
      const index = y * this.width;
      for (let x = 0; x < this.width; x++) {
        this.grid[index + x] = blank;
      }
    }

    // pad horizontal
    for (let i = 0; i < absX; i++) {
      const x = directionX > 0 ? this.width - i - 1 : i;
      for (let y = 0; y < this.height; y++) {
        this.grid[y * this.width + x] = blank;
      }
    }

    return this;
  }

  fillBackground(color: string | number): this {
    this.backgroundColor(color);
    for (let i = 0; i < this.width * this.height; i++) {
      this._puti(i, this.bg, this.fg, SPACE);
    }
    return this;
  }

  toStrings(options: { dropBlanks?: boolean } = {}): string[] {
    const rv: string[] = [];
    for (let y = 0; y < this.height; y++) {
      let line = "";
      let lastbg = -1;
      let lastfg = -1;
      let allBlank = true;
      for (let x = 0; x < this.width; x++) {
        const [ bg, fg, ch ] = this._get(x, y);
        if (lastbg != bg) line += bgString(bg);
        if (lastfg != fg) line += fgString(fg);
        lastbg = bg;
        lastfg = fg;
        line += String.fromCharCode(ch);
        if (ch != SPACE) allBlank = false;
      }
      line += RESET_ATTRIBUTES;
      rv.push(options.dropBlanks && allBlank ? "" : line);
    }
    return rv;
  }

  // ----- implementation details:

  private _put(x: number, y: number, bg: number, fg: number, ch: string | number): void {
    this._puti(y * this.width + x, bg, fg, typeof ch === "string" ? ch.charCodeAt(0) : ch);
  }

  private _puti(index: number, bg: number, fg: number, ch: number): void {
    if (bg == TRANSPARENT || fg == TRANSPARENT) {
      const [ oldbg, oldfg, _ ] = this._geti(index);
      if (bg == TRANSPARENT) bg = oldbg;
      if (fg == TRANSPARENT) fg = oldfg;
    }
    // don't try to use bit operators here. in js, they truncate the number to 32 bits first.
    this.grid[index] = bg * Math.pow(2, 28) + fg * Math.pow(2, 20) + ch;
  }

  private _get(x: number, y: number): [ number, number, number ] {
    return this._geti(y * this.width + x);
  }

  private _geti(index: number): [ number, number, number ] {
    const cell = this.grid[index];
    const colors = Math.floor(cell / Math.pow(2, 20)) & 0xffff;
    return [ colors >> 8, colors & 0xff, cell & 0xfffff ];
  }
}
