import { Terminal } from "./terminal";
import { TextBuffer } from "./text_buffer";
import * as xterm256 from "./xterm256";

const SPACE = 0x20;

// during paint, don't jump the cursor sideways unless it will move at least this far
const MIN_TAB = 5;
// during paint, if we see this many blanks in a row, check if clear-to-end-of-line would help
const THRESHOLD_BLANKS = 8;
// a good clear-to-eol must save at least 3 redraw cells (to compensate for [[K vs space).
const CLEAR_STARTING_SCORE = -3;

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

  scrollUp(x1: number, y1: number, x2: number, y2: number, n: number): this {
    for (let y = y1; y < y2 - n; y++) {
      this.nextBuffer.copySegment(x1, x2, y, y + n);
    }
    for (let y = y2 - n; y < y2; y++) {
      this.nextBuffer.clearSegment(x1, x2, y);
    }
    return this;
  }


  // ----- paint routines

  paint(): string {
    let out = "";
    if (this.nextBuffer.pendingClear) {
      out += this.changeCurrentAttr(this.nextBuffer.pendingClear) + Terminal.clearScreen();
      this.currentBuffer.clear();
    }

    this.checkForScroll();

    for (let y = 0; y < this.rows; y++) {
      if (!this.nextBuffer.isDirty(y)) continue;

      // if erasing the line from some cell would be cheaper than redrawing
      // everything, do that. update currentBuffer before calculating dirty
      // spans.
      const distance = this.computeRowDistance(y);
      for (const c of distance.clears) this.currentBuffer.clearToEndOfLine(c.x, y, c.attr);

      this.getDirtySpans(y).forEach(([ left, right ]) => {
        // optimization: if the cursor is just before the dirty span, start from the cursor instead.
        if (
          this.currentBuffer.cursorY == y &&
          this.currentBuffer.cursorX < left &&
          left - this.currentBuffer.cursorX <= MIN_TAB
        ) left = this.currentBuffer.cursorX;

        if (distance.clears.length > 0 && distance.clears[0].x < left) {
          const c = distance.clears[0];
          out += this.moveCurrent(c.x, y) + this.changeCurrentAttr(c.attr) + Terminal.eraseLine();
          distance.clears.shift();
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
      while (distance.clears.length > 0) {
        const c = distance.clears[0];
        out += this.moveCurrent(c.x, y) + this.changeCurrentAttr(c.attr) + Terminal.eraseLine();
        distance.clears.shift();
      }
    }

    this.nextBuffer.clearDirty();
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

  private computeRowDistance(ydest: number, ysource: number = ydest): LineDistance {
    // difference between source & dist lines, in # of cells that have to be redrawn
    let distance = 0;
    // track the current run of blanks with the same background attr
    let run: ClearPoint | undefined;
    // potential locations & attrs to do a clear-to-end-of-line (clrtoeol).
    // these are all "runs" of at least THRESHOLD_BLANKS spaces. score them
    // to see if they make things better or worse.
    const candidates: ClearPoint[] = [];

    for (let x = 0; x < this.cols; x++) {
      const blankAttr = this.nextBuffer.isBlank(x, ydest);
      const bg = blankAttr === undefined ? undefined : (blankAttr >> 8) & 0xff;
      const same = this.nextBuffer.isSame(x, ydest, this.currentBuffer, ysource);

      if (!same) distance++;

      // if we don't need to redraw this cell, penalize all clrtoeol
      // candidates unless the original cell is the clrtoeol blank.
      if (same) for (const c of candidates) if (c.bg != bg) c.score--;

      if (blankAttr === undefined || bg === undefined) {
        // not blank
        run = undefined;
        continue;
      }

      // extend any current run, or start a new one.
      if (run && run.bg == bg) {
        // once a run reaches the threshold, it's worth scoring.
        if (x - run.x + 1 >= THRESHOLD_BLANKS) {
          candidates.push(run);
          run = undefined;
        }
      } else {
        run = new ClearPoint(blankAttr, bg, x);
      }

      // blank: +1 to any chained candidate of this attr. -1 to any chained
      // candidate if the bg color matches a previous candidate.
      let matchedOne = false;
      for (const s of candidates) {
        if (s.bg == bg) {
          s.chainScore++;
          matchedOne = true;
        } else if (matchedOne) {
          s.chainScore--;
        }
      }
      if (run) run.chainScore++;

      // blank: +1 to any candidate of this attr if we needed to redraw
      if (!same) {
        for (const s of candidates) if (s.bg == bg) s.score++;
        if (run) run.score++;
      }
    }

    // keep only the ones with a positive score.
    let clears: ClearPoint[] = [];
    while (candidates.length > 0 && candidates[0].score <= 0) candidates.shift();
    if (candidates.length > 0) {
      clears.push(candidates[0]);
      distance -= candidates[0].score;
      // filter the rest by their "chained" score, and ensure they change the bg color.
      const rest = candidates.filter((c, i) => i == 0 || c.chainScore > 0);
      for (const c of rest.filter((c, i) => i > 0 && candidates[i - 1].bg != c.bg)) {
        clears.push(c);
        distance -= c.chainScore;
      }
    }

    return new LineDistance(distance, clears);
  }

  /*
   * find sets of rows where the rowhint implies they were all scrolled from
   * the same offset, and figure out if that scroll is worth doing.
   */
  private checkForScroll() {
    let run: ScrollRegion | undefined;
    for (let y = 0; y < this.rows; y++) {
      if (run) {
        if (this.nextBuffer.rowhint[y] == y + run.offset) continue;
        // end of a run.
        run.y2 = y + run.offset;
        console.log("consider", run, this.nextBuffer.rowhint);
        run = undefined;
      }
      if (this.nextBuffer.rowhint[y] == y) continue;
      run = new ScrollRegion(y, y, this.nextBuffer.rowhint[y] - y);
    }
    // there's no way a run can continue to the bottom of the screen.
  }

  private isWorthScrolling(region: ScrollRegion): boolean {
    let unscrolled = 0;
    // for ()
    return false;
  }

  // how expensive is it to draw ydest, if ysource is the pre-draw line?
  private computeUpdateCost(ydest: number, ysource: number): number {
    let cost = 0;
    for (let x = 0; x < this.cols; x++) {
      if (!this.nextBuffer.isSame(x, ydest, this.currentBuffer, ysource)) cost++;
    }
    return cost;
  }

  // how expensive is it to draw ydest from a blank
}

// record of a horizontal place to perform a clear-to-eol, and a score of if it's worth it
class ClearPoint {
  constructor(
    public attr: number,
    public bg: number,  // (attr >> 8) & 0xff, for convenience
    public x: number,
    public score: number = CLEAR_STARTING_SCORE,  // how much better is it to do this clrtoeol vs without?
    public chainScore: number = CLEAR_STARTING_SCORE,  // same, but assuming a previous clrtoeol
  ) {
    // pass
  }
}

// how different was this line, and where should you clear-to-eol to get that distance
class LineDistance {
  constructor(
    public distance: number,
    public clears: ClearPoint[],
  ) {
    // pass
  }
}

class ScrollRegion {
  constructor(
    public y1: number,
    public y2: number,
    public offset: number,
  ) {
    // pass
  }
}
