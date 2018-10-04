const WHITE = 7; // xterm256.get_color("gray");
const BLACK = 0; // xterm256.get_color("black");

const SPACE = 0x20;

const MAX_HEIGHT = 32767;

// maximum memory of vertical scroll events that happened between redraws
const MAX_SCROLLS = 3;

export class ScrollRegion {
  constructor(
    public top: number,
    public bottom: number,
    public rows: number,
    public attr: number
  ) {
    // pass
  }
}

export class TextBuffer {
  // unicode codepoint for each grid element (0 = blank)
  public chars: Uint32Array;
  // BBFF: background color (u8), foreground color (u8)
  public attrs: Uint16Array;

  // mark rows that have been updated
  public dirty: Uint8Array;
  // was "clear" called, and it's waiting to be painted?
  public pendingClear?: number;
  // remember the last few vertical scrolls, in case they help optimize drawing
  public pendingScrolls: ScrollRegion[] = [];

  // cursor location
  public cursorX: number;
  public cursorY: number;
  // last-set attribute (BBFF)
  public attr: number;

  constructor(public cols: number, public rows: number) {
    if (cols < 0 || rows < 0 || rows > MAX_HEIGHT) throw new Error(`Invalid terminal size ${cols} x ${rows}`);
    this.chars = new Uint32Array(rows * cols);
    this.attrs = new Uint16Array(rows * cols);
    this.dirty = new Uint8Array(Math.ceil(rows / 8));
    this.cursorX = 0;
    this.cursorY = 0;
    this.attr = (BLACK << 8) | WHITE;
  }

  put(x: number, y: number, attr: number, char: number) {
    const i = this.cols * y + x;
    this.chars[i] = char;
    this.attrs[i] = attr;
    this.setDirty(y);
  }

  getAttr(x: number, y: number): number {
    const i = this.cols * y + x;
    return this.attrs[i];
  }

  getChar(x: number, y: number): number {
    const i = this.cols * y + x;
    return this.chars[i];
  }

  set(other: TextBuffer) {
    this.chars.set(other.chars);
    this.attrs.set(other.attrs);
    this.cursorX = other.cursorX;
    this.cursorY = other.cursorY;
    this.attr = other.attr;
  }

  setSpan(x: number, y: number, x2: number, other: TextBuffer) {
    const left = this.cols * y + x;
    const right = this.cols * y + x2;
    for (let i = left; i < right; i++) {
      this.chars[i] = other.chars[i];
      this.attrs[i] = other.attrs[i];
    }
  }

  // if a cell is blank, return its attr
  isBlank(x: number, y: number): number | undefined {
    const i = this.cols * y + x;
    if (this.chars[i] == SPACE) return this.attrs[i];
    return undefined;
  }

  isSame(x: number, y: number, other: TextBuffer, othery: number = y): boolean {
    const i = this.cols * y + x;
    const oi = this.cols * othery + x;
    if (this.chars[i] != other.chars[oi]) return false;
    if (this.chars[i] == SPACE) return ((this.attrs[i] >> 8) & 0xff) == ((other.attrs[oi] >> 8) & 0xff);
    return this.attrs[i] == other.attrs[oi];
  }

  copySegment(x1: number, x2: number, ydest: number, ysource: number) {
    this.setDirty(ydest);
    for (let x = x1; x < x2; x++) {
      this.attrs[this.cols * ydest + x] = this.attrs[this.cols * ysource + x];
      this.chars[this.cols * ydest + x] = this.chars[this.cols * ysource + x];
    }
  }

  clearSegment(x1: number, x2: number, y: number) {
    const start = this.cols * y + x1;
    for (let i = 0; i < x2 - x1; i++) {
      this.attrs[start + i] = this.attr;
      this.chars[start + i] = SPACE;
    }
  }

  clearToEndOfLine(x: number, y: number, attr: number = this.attr) {
    for (; x < this.cols; x++) this.put(x, y, attr, SPACE);
  }

  clear() {
    for (let y = 0; y < this.rows; y++) this.clearSegment(0, this.cols, y);
    // remember that we cleared the screen, and forget all dirty row hints
    this.clearDirty();
    this.pendingClear = this.attr;
    this.cursorX = 0;
    this.cursorY = 0;
  }

  setDirty(y: number) {
    this.dirty[Math.floor(y / 8)] |= (1 << (y % 8));
  }

  isDirty(y: number): boolean {
    return (this.dirty[Math.floor(y / 8)] & (1 << (y % 8))) != 0;
  }

  addScroll(top: number, bottom: number, rows: number) {
    this.pendingScrolls.push(new ScrollRegion(top, bottom, rows, this.attr));
    while (this.pendingScrolls.length > MAX_SCROLLS) this.pendingScrolls.pop();
  }

  clearDirty() {
    delete this.pendingClear;
    for (let i = 0; i < this.dirty.length; i++) this.dirty[i] = 0;
    while (this.pendingScrolls.length > 0) this.pendingScrolls.pop();
  }
}
