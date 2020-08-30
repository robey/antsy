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
  public chars!: Uint32Array;
  // BBFF: background color (u8), foreground color (u8)
  public attrs!: Uint16Array;

  // mark rows that have been updated
  public dirty!: Uint8Array;
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
    this.alloc(cols, rows);
    this.cursorX = 0;
    this.cursorY = 0;
    this.attr = -1;
  }

  resize(cols: number, rows: number, defaultAttr: number) {
    const oldChars = this.chars;
    const oldAttrs = this.attrs;
    const oldCols = this.cols;
    const oldRows = this.rows;
    this.alloc(cols, rows);

    // invalidate everything, then copy over what will fit.
    this.clearBox(0, 0, cols, rows, defaultAttr);
    for (let y = 0; y < Math.min(oldRows, this.rows); y++) {
      this.setDirty(y);
      const left = this.cols * y;
      const oldLeft = oldCols * y;
      for (let x = 0; x < Math.min(oldCols, this.cols); x++) {
        this.chars[left + x] = oldChars[oldLeft + x];
        this.attrs[left + x] = oldAttrs[oldLeft + x];
      }
    }

    this.pendingScrolls = [];
    this.cursorX = Math.min(this.cursorX, cols - 1);
    this.cursorY = Math.min(this.cursorY, rows - 1);
  }

  private alloc(cols: number, rows: number) {
    if (cols < 0 || rows < 0 || rows > MAX_HEIGHT) throw new Error(`Invalid terminal size ${cols} x ${rows}`);
    this.chars = new Uint32Array(rows * cols);
    this.attrs = new Uint16Array(rows * cols);
    this.dirty = new Uint8Array(Math.ceil(rows / 8));
    this.cols = cols;
    this.rows = rows;
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

  copySegment(xdest: number, ydest: number, xsource: number, ysource: number, count: number) {
    for (let i = 0; i < count; i++) {
      let dest = this.cols * ydest + xdest;
      let source = this.cols * ysource + xsource;
      if (xdest <= xsource) {
        this.attrs[dest + i] = this.attrs[source + i];
        this.chars[dest + i] = this.chars[source + i];
      } else {
        this.attrs[dest + count - i - 1] = this.attrs[source + count - i - 1];
        this.chars[dest + count - i - 1] = this.chars[source + count - i - 1];
      }
    }
    this.setDirty(ydest);
  }

  clearSegment(x1: number, x2: number, y: number, attr: number) {
    const start = this.cols * y + x1;
    for (let i = 0; i < x2 - x1; i++) {
      this.attrs[start + i] = attr;
      this.chars[start + i] = SPACE;
    }
    this.setDirty(y);
  }

  clearToEndOfLine(x: number, y: number, attr: number) {
    for (; x < this.cols; x++) this.put(x, y, attr, SPACE);
  }

  setDirty(y: number) {
    this.dirty[Math.floor(y / 8)] |= (1 << (y % 8));
  }

  isDirty(y: number): boolean {
    return (this.dirty[Math.floor(y / 8)] & (1 << (y % 8))) != 0;
  }

  // move a box bounded by (x1, y1) and (x2, y2) up/down/left/right
  copyBox(x1: number, y1: number, x2: number, y2: number, cols: number, rows: number) {
    for (let v = 0; v < y2 - y1; v++) {
      let ydest = rows > 0 ? y2 + rows - v - 1 : y1 + rows + v;
      let ysource = rows > 0 ? y2 - v - 1 : y1 + v;
      this.copySegment(x1 + cols, ydest, x1, ysource, x2 - x1);
    }
  }

  // draw another TextBuffer into myself.
  putBox(x1: number, y1: number, other: TextBuffer, ox1: number, oy1: number, ox2: number, oy2: number) {
    let offset = this.cols * y1 + x1;
    let otherOffset = other.cols * oy1 + ox1;
    for (let v = 0; v < oy2 - oy1; v++) {
      this.attrs.set(other.attrs.slice(otherOffset, otherOffset + ox2 - ox1), offset);
      this.chars.set(other.chars.slice(otherOffset, otherOffset + ox2 - ox1), offset);
      this.setDirty(y1 + v);
      offset += this.cols;
      otherOffset += other.cols;
    }
  }

  clearBox(x1: number, y1: number, x2: number, y2: number, attr: number) {
    for (let y = y1; y < y2; y++) this.clearSegment(x1, x2, y, attr);
    if (x1 == 0 && x2 == this.cols && y1 == 0 && y2 == this.rows) {
      // cleared the whole screen. memoize that.
      this.clearDirty();
      this.pendingClear = attr;
      this.cursorX = 0;
      this.cursorY = 0;
    }
  }

  scrollUp(x1: number, y1: number, x2: number, y2: number, rows: number, attr: number) {
    this.copyBox(x1, y1 + rows, x2, y2, 0, -rows);
    for (let y = y2 - rows; y < y2; y++) this.clearSegment(x1, x2, y, attr);

    this.pendingScrolls.push(new ScrollRegion(y1, y2, rows, attr));
    while (this.pendingScrolls.length > MAX_SCROLLS) this.pendingScrolls.pop();
  }

  scrollDown(x1: number, y1: number, x2: number, y2: number, rows: number, attr: number) {
    this.copyBox(x1, y1, x2, y2 - rows, 0, rows);
    for (let y = y1; y < y1 + rows; y++) this.clearSegment(x1, x2, y, attr);

    this.pendingScrolls.push(new ScrollRegion(y1, y2, -rows, attr));
    while (this.pendingScrolls.length > MAX_SCROLLS) this.pendingScrolls.pop();
  }

  scrollLeft(x1: number, y1: number, x2: number, y2: number, cols: number, attr: number) {
    this.copyBox(x1 + cols, y1, x2, y2, -cols, 0);
    for (let y = y1; y < y2; y++) this.clearSegment(x2 - cols, x2, y, attr);
  }

  scrollRight(x1: number, y1: number, x2: number, y2: number, cols: number, attr: number) {
    this.copyBox(x1, y1, x2 - cols, y2, cols, 0);
    for (let y = y1; y < y2; y++) this.clearSegment(x1, x1 + cols, y, attr);
  }

  clearDirty() {
    delete this.pendingClear;
    for (let i = 0; i < this.dirty.length; i++) this.dirty[i] = 0;
    while (this.pendingScrolls.length > 0) this.pendingScrolls.pop();
  }
}
