const WHITE = 7; // xterm256.get_color("gray");
const BLACK = 0; // xterm256.get_color("black");

const SPACE = 0x20;

export class TextBuffer {
  // unicode codepoint for each grid element (0 = blank)
  public chars: Uint32Array;
  // BBFF: background color (u8), foreground color (u8)
  public attrs: Uint16Array;

  // mark rows that have been updated
  public dirty: Uint8Array;
  // was "clear" called, and it's waiting to be painted?
  public dirtyClear?: number;

  // cursor location
  public cursorX: number;
  public cursorY: number;
  // last-set attribute (BBFF)
  public attr: number;

  constructor(public cols: number, public rows: number) {
    this.chars = new Uint32Array(rows * cols);
    this.attrs = new Uint16Array(rows * cols);
    this.dirty = new Uint8Array(rows);
    this.cursorX = 0;
    this.cursorY = 0;
    this.attr = (BLACK << 8) | WHITE;
  }

  put(x: number, y: number, attr: number, char: number) {
    const i = this.cols * y + x;
    this.chars[i] = char;
    this.attrs[i] = attr;
    this.dirty[y] = 1;
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

  isSame(x: number, y: number, other: TextBuffer): boolean {
    const i = this.cols * y + x;
    if (this.chars[i] != other.chars[i]) return false;
    if (this.chars[i] == SPACE) return ((this.attrs[i] >> 8) & 0xff) == ((other.attrs[i] >> 8) & 0xff);
    return this.attrs[i] == other.attrs[i];
  }

  blankLine(y: number, attr: number) {
    for (let i = this.cols * y; i < this.cols * (y + 1); i++) {
      this.attrs[i] = attr;
      this.chars[i] = SPACE;
    }
  }

  clearToEndOfLine(x: number, y: number, attr: number = this.attr) {
    for (; x < this.cols; x++) this.put(x, y, attr, SPACE);
  }

  clear() {
    for (let y = 0; y < this.rows; y++) this.blankLine(y, this.attr);
    this.dirtyClear = this.attr;
    this.cursorX = 0;
    this.cursorY = 0;
  }

  clearDirty() {
    for (let y = 0; y < this.rows; y++) this.dirty[y] = 0;
  }
}
