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

  scrollUp(x1: number, y1: number, x2: number, y2: number, n: number): this {
    for (let y = y1; y < y2 - n; y++) {
      this.nextBuffer.copySegment(x1, x2, y, y + n);
    }
    for (let y = y2 - n; y < y2; y++) {
      this.nextBuffer.clearSegment(x1, x2, y);
    }
    this.nextBuffer.addScroll(y1, y2, n);
    return this;
  }


  // ----- paint routines

  paint(): string {
    return computeDiff(this.currentBuffer, this.nextBuffer);
  }






  // /*
  //  * find sets of rows where the rowhint implies they were all scrolled from
  //  * the same offset, and figure out if that scroll is worth doing.
  //  */
  // private checkForScroll() {
  //   let run: ScrollRegion | undefined;
  //   for (let y = 0; y < this.rows; y++) {
  //     if (run) {
  //       if (this.nextBuffer.rowhint[y] == y + run.offset) continue;
  //       // end of a run.
  //       const offset = run.offset;
  //       run.y2 = y + offset;
  //       console.log("consider", run, this.nextBuffer.rowhint);
  //       const originalCost = range(run.y1, run.y2).reduce((sum, y) => {
  //         return sum + this.computeRowDistance(y).distance;
  //       }, 0);
  //       const newCost = range(run.y1, y).reduce((sum, y) => {
  //         return sum + this.computeRowDistance(y, y + offset).distance;
  //       }, 0) + range(y, run.y2).reduce((sum, y) => sum + this.computeBlankDistance(y), 0);
  //       console.log("cost", originalCost, newCost);
  //       run = undefined;
  //     }
  //     if (this.nextBuffer.rowhint[y] == y) continue;
  //     run = new ScrollRegion(y, y, this.nextBuffer.rowhint[y] - y);
  //   }
  //   // there's no way a run can continue to the bottom of the screen.
  // }

  // private isWorthScrolling(region: ScrollRegion): boolean {
  //   let unscrolled = 0;
  //   // for ()
  //   return false;
  // }

  // // how expensive is it to draw ydest, if ysource is the pre-draw line?
  // // FIXME: figure out what the best blank would be
  // private computeBlankDistance(y: number): number {
  //   let cost = 0;
  //   for (let x = 0; x < this.cols; x++) {
  //     const attr = this.nextBuffer.isBlank(x, y);
  //     if (attr === undefined || (attr & 0xff00) != (this.currentBuffer.attr & 0xff)) cost++;
  //   }
  //   console.log("blank cost", cost);
  //   return cost;
  // }

}
