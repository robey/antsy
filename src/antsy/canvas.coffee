xterm256 = require "./xterm256"

SPACE = " ".charCodeAt(0)

UNDERLINE_START = "\u001b[4m"
UNDERLINE_STOP = "\u001b[24m"
RESET_ATTRIBUTES = "\u001b[0m"

fgString = (index) -> "\u001b[38;5;#{index}m"
bgString = (index) -> "\u001b[48;5;#{index}m"

TRANSPARENT = -1

class Canvas
  constructor: (@width, @height) ->
    # (y, x) indexed, with each entry: BBFFCCCCC
    # (B = bg color, F = fg color, C = 20-bit unichar)
    @grid = new Array(@width * @height)
    @fg = xterm256.get_color("white")
    @bg = xterm256.get_color("black")
    @fillBackground("black")
    @y = 0
    @x = 0

  color: (color) ->
    if typeof color == "string" then color = xterm256.get_color(color)
    @fg = color
    @

  backgroundColor: (color) ->
    if typeof color == "string" then color = xterm256.get_color(color)
    @bg = color
    @

  at: (x, y) ->
    @x = x
    @y = y
    @

  write: (s) ->
    for i in [0 ... s.length]
      @put(@x, @y, @bg, @fg, s[i])
      @x += 1
      if @x >= @width
        @x = 0
        @y += 1
        if @y >= @height
          @y = 0
    @

  fillBackground: (color) ->
    @backgroundColor(color)
    [0 ... @width * @height].map (i) => @puti(i, @bg, @fg, SPACE)
    @

  toStrings: ->
    [0 ... @height].map (y) =>
      line = ""
      lastbg = -1
      lastfg = -1
      [0 ... @width].map (x) =>
        [ bg, fg, ch ] = @get(x, y)
        if lastbg != bg then line += bgString(bg)
        if lastfg != fg then line += fgString(fg)
        lastbg = bg
        lastfg = fg
        line += String.fromCharCode(ch)
      line += RESET_ATTRIBUTES
      line

  # ----- implementation details:

  put: (x, y, bg, fg, ch) ->
    if typeof ch == "string" then ch = ch.charCodeAt(0)
    @puti(y * @width + x, bg, fg, ch)

  puti: (index, bg, fg, ch) ->
    if bg == TRANSPARENT or fg == TRANSPARENT
      [ oldbg, oldfg, _ ] = @geti(index)
      if bg == TRANSPARENT then bg = oldbg
      if fg == TRANSPARENT then fg = oldfg
    # don't try to use bit operators here. in js, they truncate the number to 32 bits first.
    @grid[index] = bg * Math.pow(2, 28) + fg * Math.pow(2, 20) + ch

  get: (x, y) -> @geti(y * @width + x)

  geti: (index) ->
    x = @grid[index]
    colors = Math.floor(x / Math.pow(2, 20))
    [ colors >> 8, colors & 0xff, x & 0xfffff ]


exports.Canvas = Canvas
exports.RESET_ATTRIBUTES = RESET_ATTRIBUTES
exports.TRANSPARENT = TRANSPARENT

