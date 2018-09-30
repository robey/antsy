import * as xterm256 from "./xterm256";
import { Terminal } from "./terminal";
import { readlinkSync } from "fs";

const SPACE = 0x20;

// during paint, don't jump the cursor sideways unless it will move at least this far
const MIN_TAB = 5;
// during paint, if we see this many blanks in a row, erase the line
const THRESHOLD_BLANKS = 8;


export const TRANSPARENT = -1;
const WHITE = 7; // xterm256.get_color("gray");
const BLACK = 0; // xterm256.get_color("black");

class TextBuffer {
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
    this.nextBuffer.clearDirty();
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


  // ----- paint routines

  paint(): string {
    let out = "";
    if (this.nextBuffer.dirtyClear) {
      out += this.changeCurrentAttr(this.nextBuffer.dirtyClear) + Terminal.clearScreen();
      this.currentBuffer.clear();
      delete this.nextBuffer.dirtyClear;
    }

    for (let y = 0; y < this.rows; y++) {
      if (this.nextBuffer.dirty[y] == 0) continue;
      this.nextBuffer.dirty[y] = 0;

      // if erasing the line from some cell would be cheaper than redrawing
      // everything, do that. update currentBuffer before calculating dirty
      // spans.
      let blanks = this.checkForEraseOptimisation(y);
      for (const b of blanks) this.currentBuffer.clearToEndOfLine(b.x, y, b.attr);

      this.getDirtySpans(y).forEach(([ left, right ]) => {
        // optimization: if the cursor is just before the dirty span, start from the cursor instead.
        if (
          this.currentBuffer.cursorY == y &&
          this.currentBuffer.cursorX < left &&
          left - this.currentBuffer.cursorX <= MIN_TAB
        ) left = this.currentBuffer.cursorX;

        if (blanks[0] && blanks[0].x < left) {
          const b = blanks.shift();
          if (b) out += this.moveCurrent(b.x, y) + this.changeCurrentAttr(b.attr) + Terminal.eraseLine();
        }
        out += this.moveCurrent(left, y);
        for (let x = left; x < right; x++) {
          out += this.changeCurrentAttr(this.nextBuffer.getAttr(x, y));
          out += String.fromCodePoint(this.nextBuffer.getChar(x, y));
        }

        this.currentBuffer.setSpan(left, y, right, this.nextBuffer);
        this.currentBuffer.cursorX = right;
      });

      // erase happened after all the dirty bits.
      while (blanks.length > 0) {
        const b = blanks.shift();
        if (b) out += this.moveCurrent(b.x, y) + this.changeCurrentAttr(b.attr) + Terminal.eraseLine();
      }
    }

    return out;
  }

  // move work cursor to (newX, newY)
  private moveCurrent(newX: number, newY: number): string {
    const oldX = this.currentBuffer.cursorX, oldY = this.currentBuffer.cursorY;
    this.currentBuffer.cursorX = newX;
    this.currentBuffer.cursorY = newY;
    if (oldX == newX && oldY == newY) return "";
    if (oldX == newX) return Terminal.moveRelative(0, newY - oldY);
    if (oldY == newY) return Terminal.moveRelative(newX - oldX, 0);
    return Terminal.move(newX, newY);
  }

  private changeCurrentAttr(attr: number): string {
    if (this.currentBuffer.attr == -1) this.currentBuffer.attr = 0xffff ^ attr;
    if (attr == this.currentBuffer.attr) return "";
    const newfg = attr & 0xff, newbg = (attr >> 8) & 0xff;
    const oldfg = this.currentBuffer.attr & 0xff, oldbg = (this.currentBuffer.attr >> 8) & 0xff;
    this.currentBuffer.attr = attr;
    return (oldfg != newfg ? Terminal.fg(newfg) : "") + ((oldbg != newbg) ? Terminal.bg(newbg) : "");
  }

  // find a list of dirty spans on this row.
  private getDirtySpans(y: number): [ number, number ][] {
    const spans: [ number, number ][] = [];

    for (let left = 0; left < this.cols; left++) {
      if (this.nextBuffer.isSame(left, y, this.currentBuffer)) continue;

      // now find the right extent of the segment that's different
      let right = left + 1;
      while (right < this.cols && !this.nextBuffer.isSame(right, y, this.currentBuffer)) {
        right++;
      }

      // merge segments that are less than MIN_TAB apart
      const prev = spans.length - 1;
      if (prev >= 0 && left - spans[prev][1] < MIN_TAB) {
        spans[prev][1] = right;
      } else {
        spans.push([ left, right ]);
      }
      left = right;
    }

    return spans;
  }

  /*
   * scan the line, looking for cells that are newly blank. for each new
   * blank we find, pretend we did an "erase to end of line" operation there,
   * and score how much better or worse our paint work would be in that case:
   * subtract 1 point for each cell we'd need to redraw that was untouched
   * before, and add 1 point for each cell we were about to redraw but could
   * now skip. if any "erase to end of line" operation passes some "worth it"
   * threshold, pick the best.
   *
   * i'm highly skeptical that this is worth doing, but it was fun.
   */
  private checkForEraseOptimisation(y: number): AttrScore[] {
    // track the current run of blanks with the same background attr
    let run: AttrScore | undefined;
    // potential locations & attrs to do a clear-to-end-of-line from. these
    // are all "runs" that had at least THRESHOLD_BLANKS spaces in a row.
    const candidates: AttrScore[] = [];

    for (let x = 0; x < this.cols; x++) {
      const attr = this.nextBuffer.isBlank(x, y);
      if (attr === undefined) {
        // not blank: -1 point for everyone if it's unchanged, +0 if it's
        // changed (we have to draw it anyway). kill any run.
        run = undefined;
        if (this.nextBuffer.isSame(x, y, this.currentBuffer)) {
          candidates.forEach(s => s.score--);
        }
      } else {
        const bg = (attr >> 8) & 0xff;

        // extend any current run, or start a new one.
        if (run && run.bg == bg) {
          // once a run reaches the threshold, it's worth scoring.
          if (x - run.x + 1 >= THRESHOLD_BLANKS) {
            candidates.push(run);
            run = undefined;
          }
        } else {
          run = new AttrScore(attr, bg, x, 0);
        }

        if (!this.nextBuffer.isSame(x, y, this.currentBuffer)) {
          // blank, changed: +1 to this attr, -1 to others.
          for (const s of candidates) s.score += (s.bg == bg ? 1 : -1);
          if (run) run.score++;
        } else {
          // blank, unchanged: -1 to any cell of a different attr
          for (const s of candidates) if (s.bg != bg) s.score--;
        }
      }
    }

    // keep only the ones with a score above 2 ([[K vs space), sort them by
    // x, and drop any redundant ones that just repeat the previous bg color.
    const sorted = candidates.filter(s => s.score > 2).sort((a, b) => a.x - b.x);
    return sorted.filter((s, i) => i == 0 || sorted[i - 1].bg != s.bg);
  }
}

class AttrScore {
  constructor(
    public attr: number,
    public bg: number,  // (attr >> 8) & 0xff, for convenience
    public x: number,
    public score: number
  ) {
    // pass
  }
}
