import { TextBuffer, ScrollRegion } from "./text_buffer";
import { Terminal } from "./terminal";

// if we see this many blanks in a row, check if clear-to-end-of-line would help
const THRESHOLD_BLANKS = 8;
// a good clear-to-eol must save at least 3 redraw cells (to compensate for [[K vs space).
const CLEAR_STARTING_SCORE = -3;
// don't jump the cursor sideways unless it will move at least this far
const MIN_TAB = 5;
// a vertical scroll must save us at least this many dirty cells to be useful
const THRESHOLD_SCROLL = 6;

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


/*
 * compute the difference between 2 TextBuffer's and generate a string of
 * VT-xterm codes to turn one into the other. in the process, the original
 * buffer is modified to become a copy of the new buffer.
 *
 * this is in its own file because it gets a little hairy: it will try to
 * use scrolling regions and clear-to-end-of-line codes if they will help.
 */
export function computeDiff(oldBuffer: TextBuffer, newBuffer: TextBuffer): string {
  let out = "";
  if (newBuffer.pendingClear) {
    out += changeAttr(oldBuffer, newBuffer.pendingClear) + Terminal.clearScreen();
    oldBuffer.clearBox(0, 0, oldBuffer.cols, oldBuffer.rows, newBuffer.pendingClear);
    oldBuffer.cursorX = 0;
    oldBuffer.cursorY = 0;
  }

  // check if scrolling a vertical region would help
  for (const s of newBuffer.pendingScrolls) {
    out += checkScroll(oldBuffer, newBuffer, s);
  }

  for (const y of range(0, oldBuffer.rows)) {
    if (!newBuffer.isDirty(y)) continue;

    // if erasing the line from some cell would be cheaper than redrawing
    // everything, do that. update currentBuffer before calculating dirty
    // spans.
    const distance = computeRowDistance(oldBuffer, y, newBuffer);
    for (const c of distance.clears) oldBuffer.clearToEndOfLine(c.x, y, c.attr);

    for (let [ left, right ] of getDirtySpans(oldBuffer, newBuffer, y)) {
      // optimization: if the cursor is just before the dirty span, start from the cursor instead.
      if (oldBuffer.cursorY == y && oldBuffer.cursorX < left && left - oldBuffer.cursorX <= MIN_TAB) {
        left = oldBuffer.cursorX;
      }

      while (distance.clears.length > 0 && distance.clears[0].x < left) {
        const c = distance.clears[0];
        out += move(oldBuffer, c.x, y) + changeAttr(oldBuffer, c.attr, false) + Terminal.eraseLine();
        distance.clears.shift();
      }
      out += move(oldBuffer, left, y);
      for (const x of range(left, right)) {
        const ch = String.fromCodePoint(newBuffer.getChar(x, y));
        out += changeAttr(oldBuffer, newBuffer.getAttr(x, y), ch != " ");
        out += ch;
      }

      oldBuffer.setSpan(left, y, right, newBuffer);
      oldBuffer.cursorX = right;
    }

    // erase happened after all the dirty bits.
    while (distance.clears.length > 0) {
      const c = distance.clears[0];
      out += move(oldBuffer, c.x, y) + changeAttr(oldBuffer, c.attr, false) + Terminal.eraseLine();
      distance.clears.shift();
    }
  }

  out += move(oldBuffer, newBuffer.cursorX, newBuffer.cursorY);
  newBuffer.clearDirty();
  return out;
}

function computeRowDistance(
  oldBuffer: TextBuffer,
  oldy: number,
  newBuffer: TextBuffer,
  newy: number = oldy,
): LineDistance {
  // difference between source & dist lines, in # of cells that have to be redrawn
  let distance = 0;
  // track the current run of blanks with the same background attr
  let run: ClearPoint | undefined;
  // potential locations & attrs to do a clear-to-end-of-line (clrtoeol).
  // these are all "runs" of at least THRESHOLD_BLANKS spaces. score them
  // to see if they make things better or worse.
  const candidates: ClearPoint[] = [];

  const endRun = (x: number) => {
    // once a run reaches the threshold, it's worth scoring.
    if (run && x - run.x + 1 >= THRESHOLD_BLANKS) candidates.push(run);
    run = undefined;
  };

  for (const x of range(0, oldBuffer.cols)) {
    const blankAttr = newBuffer.isBlank(x, newy);
    const bg = blankAttr === undefined ? undefined : (blankAttr >> 8) & 0xff;
    const same = newBuffer.isSame(x, newy, oldBuffer, oldy);

    if (!same) distance++;

    // if we don't need to redraw this cell, penalize all clrtoeol
    // candidates unless the original cell is the clrtoeol blank.
    if (same) for (const c of candidates) if (c.bg != bg) c.score--;

    if (blankAttr === undefined || bg === undefined) {
      // not blank
      endRun(x);
      continue;
    }

    // start a new run?
    if (!run || run.bg != bg) {
      endRun(x);
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

  endRun(oldBuffer.cols);

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

// find a list of dirty spans on this row.
function getDirtySpans(oldBuffer: TextBuffer, newBuffer: TextBuffer, y: number): [ number, number ][] {
  const spans: [ number, number ][] = [];

  for (let left = 0; left < oldBuffer.cols; left++) {
    if (newBuffer.isSame(left, y, oldBuffer)) continue;

    // now find the right extent of the segment that's different
    let right = left + 1;
    while (right < oldBuffer.cols && !newBuffer.isSame(right, y, oldBuffer)) {
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

function checkScroll(oldBuffer: TextBuffer, newBuffer: TextBuffer, s: ScrollRegion): string {
  let newCost = 0;
  const originalCost = sum(range(s.top, s.bottom), y => computeRowDistance(oldBuffer, y, newBuffer).distance);
  if (s.rows > 0) {
    newCost += sum(range(s.top, s.bottom - s.rows), y => {
      return computeRowDistance(oldBuffer, y + s.rows, newBuffer, y).distance;
    });
    newCost += sum(range(s.bottom - s.rows, s.bottom), y => computeBlankDistance(newBuffer, y, s.attr));
  } else {
    const rows = -s.rows;
    newCost += sum(range(s.top + rows, s.bottom), y => {
      return computeRowDistance(oldBuffer, y - rows, newBuffer, y).distance;
    });
    newCost += sum(range(s.top, s.top + rows), y => computeBlankDistance(newBuffer, y, s.attr));
  }

  if (originalCost - newCost < THRESHOLD_SCROLL) return "";

  let out = changeAttr(oldBuffer, s.attr);
  if (s.rows > 0) {
    out += Terminal.scrollUp(s.top, s.bottom, s.rows);
    oldBuffer.scrollUp(0, s.top, oldBuffer.cols, s.bottom, s.rows, oldBuffer.attr);
  } else {
    out += Terminal.scrollDown(s.top, s.bottom, -s.rows);
    oldBuffer.scrollDown(0, s.top, oldBuffer.cols, s.bottom, -s.rows, oldBuffer.attr);
  }
  // cursor is scrambled
  oldBuffer.cursorX = -1;
  oldBuffer.cursorY = -1;
  return out;
}

// how expensive is it to draw ydest, if ysource is the pre-draw line?
function computeBlankDistance(buffer: TextBuffer, y: number, blank: number): number {
  return sum(range(0, buffer.cols), x => {
    const attr = buffer.isBlank(x, y);
    return (attr === undefined || (attr & 0xff00) != (blank & 0xff00)) ? 1 : 0;
  });
}

// change a buffer's attr (fg & bg colors), and return the smallest code needed to do that.
function changeAttr(buffer: TextBuffer, attr: number, needForeground: boolean = true): string {
  // if the current attr is -1, force both fg & bg to be generated.
  if (buffer.attr == -1) buffer.attr = 0xffff ^ attr;
  if (attr == buffer.attr) return "";
  if (!needForeground) attr = (attr & 0xff00) | (buffer.attr & 0xff);
  let newfg = attr & 0xff, newbg = (attr >> 8) & 0xff;
  const oldfg = buffer.attr & 0xff, oldbg = (buffer.attr >> 8) & 0xff;
  buffer.attr = attr;
  return (oldfg != newfg ? Terminal.fg(newfg) : "") + ((oldbg != newbg) ? Terminal.bg(newbg) : "");
}

// move cursor to (newX, newY)
function move(buffer: TextBuffer, newX: number, newY: number): string {
  const oldX = buffer.cursorX, oldY = buffer.cursorY;
  buffer.cursorX = newX;
  buffer.cursorY = newY;
  if (oldX < 0 || oldY < 0) return Terminal.move(newX, newY);
  if (oldX == newX && oldY == newY) return "";
  if (oldX == newX) return Terminal.moveRelative(0, newY - oldY);
  // vt100 quirk: if we think the cursor is "just off-screen", what really
  // happened is that we wrote into the final column of the screen, and
  // the terminal didn't actually advance the cursor... or did it? for
  // safety, assume we need to be explicit.
  if (oldY == newY && oldX < buffer.cols) return Terminal.moveRelative(newX - oldX, 0);
  return Terminal.move(newX, newY);
}

// *sings the song of my people*: "this should be in the stdlib"
function range(start: number, end: number, step: number = 1): number[] {
  return [...Array(Math.ceil((end - start) / step)).keys()].map(i => i * step + start);
}

function sum<A>(list: A[], f: (item: A) => number): number {
  return list.reduce((total, item) => total + f(item), 0);
}
