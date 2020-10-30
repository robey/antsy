# Antsy

Antsy is a library that provides a canvas for drawing full-color (xterm-256) text and generating the ANSI/xterm codes to efficiently paint it into a terminal. It remembers the previous state after each `paint` operation, so as you update the canvas, it generates only the minimal codes necessary for the update.

It's like a modern typescript implementation of the lower half of ncurses.

```javascript
var antsy = require("antsy");
var canvas = new antsy.Canvas(80, 24);
var region = canvas.all();
region.at(0, 23).backgroundColor("#000080").write("i am on a blue background!");

// now write it out to the terminal!
// generates: '\e[37m\e[40m\e[2J\e[H\e[23B\e[44mi am on a blue background!\e[H'
process.stdout.write(canvas.paint());

region.at(10, 23).color("#ff0").write("BLUE");

// now update that word!
// generates: '\e[24;11H\e[38;5;11mBLUE\e[H'
process.stdout.write(canvas.paint());
```

That's all it does. The intent is that this would be enough to build a widget library on top of, if you want, by using a separate Canvas for each widget, drawing them into the main canvas in z-buffer order, and calling `paint()` to generate the diff as ANSI/xterm codes. (Check `test_canvas.ts` for an example.)


## xterm-256

All modern terminals support 256-color "xterm" control codes, so antsy uses them. There's an [exhaustive explanation of the encoding](docs/xterm-256.md) in the docs/ folder.

Antsy uses an incredibly fast, state-of-the-art hylaean algorithm for determining the closest "xterm" color to a 24-bit web-style color code. You can use it yourself via the exported `get_color` function:

```javascript
var color = antsy.get_color("#ffffff"); // 15
```

It also understands the three-letter alternate forms ("f00") and a basic set of American color names ("teal", "brown", and so on).


## Canvas

Antsy models a screen (or framebuffer) as a "canvas" which generates the ANSI codes, and clip regions which support drawing commands.

- `new Canvas(cols: number, rows: number)`

    Create a new canvas with a framebuffer of the requested size. It will be cleared to white-on-black.

- `all(): Region`

    Return a new clipping/drawing region that covers the entire canvas.

- `clip(x1: number, y1: number, x2: number, y2: number): Region`

    Return a new clipping/drawing region that begins at `x1, y1` inclusive and ends at `x2, y2` exclusive. For example, `clip(4, 3, 10, 5)` will return a region with an origin at column 4 (counting from 0), row 3, and is 6 columns wide and 2 columns tall. The point `(0, 0)` in the region will map to `(4, 3)` in the canvas.

- `paint(): string`

    Return the ANSI codes that will paint the current canvas contents, since the last call. Each call to `paint()` caches the current canvas state, so that future updates only paint the parts of the screen that have changed since last time.

- `paintInline(): string`

    Return the ANSI codes that will paint the current canvas contents as if the screen was in an unknown (dirty) state. Every glyph and color will be rendered, separated by linefeeds, without cursor manipulation. This may be useful for rendering small canvases that are meant to be embedded in other displays or output that doesn't know about the canvas.


## Region

A clip region maps a rectangle of the canvas, and can be drawn on.

- `all(): Region`

    Return this region. This method exists only to match the method on `Canvas`.

- `clip(x1: number, y1: number, x2: number, y2: number): Region`

    Return a new clipping/drawing region that's possibly smaller than the current one. It can't expand to cover more than the current region.

- `color(fg?: string | number, bg?: string | number): this`
- `backgroundColor(bg: string | number): this`

    Change the foreground (and optionally the background) color to match either a name or an HTML-style hex string like `#ff0088`.

- `at(x: number, y: number): this`

    Move the local cursor. Coordinates are zero-based.

- `clear(): this`

    Clear the entire region to the current background color.

- `write(s: string): this`

    Write a string to the current cursor coordinates. Text will wrap within the region if necessary. If text goes past the bottom line of the region, it will be scrolled.

- `draw(other: Region): this`

    Copy a region from another canvas into this region. If the other region is larger than this one, it will be clipped. The other region is always drawn into this one at `(0, 0)`: to draw into another coordinate, `clip` the region first. You can use this to give each UX element ("widget") its own canvas, and draw them into a region of the canvas representing the screen.

- `scrollUp(rows: number = 1): this`
- `scrollDown(rows: number = 1): this`
- `scrollLeft(cols: number = 1): this`
- `scrollRight(cols: number = 1): this`

    Scroll the region horizontally or vertically. "Up" means the characters shift up (like a scrolling terminal), and "down", "left", and "right" have similar meanings. New areas are filled with the current background color.

- `moveCursor(x: number = this.cursorX, y: number = this.cursorY): this`

    Move the screen's physical block cursor, either to an explicit cell, or to the current cursor location. This causes `paint()` to emit codes to move the cursor after all other drawing is done.


## How it works

`Canvas` stores two framebuffers: a "current" and a "next" one. They start identical, but all modifications made thru `Region`s are to the "next" buffer. Each "paint" call compares them and performs steps to make "current" match "next":

1. If `clear()` was ever called on the entire canvas (`canvas.all().clear()`), then it emits a code to clear the current buffer to the color of the most recent `clear()` call.

2. If any region was recently scrolled vertically, it checks to see if scrolling a section of the screen would be cheaper than redrawing those lines. If it would, then it emits the codes to set and scroll that section. ANSI/xterm only support scrolling a range of rows as wide as the screen, not just any rectangular box, so this isn't helpful as often as you'd hope.

3. Finally, it iterates across all the rows that are different, "diffs" them, and redraws the needed segments. If it would be cheaper to emit an "erase to the end of the line" code anywhere along the row, then it will.

After redrawing everything, it emits a code to move the cursor to the desired cell, and the two buffers are now identical. This logic is all in `canvas_diff.ts`.


## To-do

JS/ES cannot currently handle grapheme boundaries of combining marks, or identification of double-wide fixed-width glyphs (like emojis). Grapheme boundaries will be part of a [future spec](https://github.com/tc39/proposal-intl-segmenter). Heuristics may work for double-wide glyph detection. But until JS/ES support improves, this library will only work well with single-codepoint, single-width glyphs. If that's a bunch of jargon to you: "Stick with the ISO-8859 character sets or ASCII for now." :)


## License

Apache 2 (open-source) license, included in `LICENSE.txt`.


## Authors

@robey - Robey Pointer <robeypointer@gmail.com>
