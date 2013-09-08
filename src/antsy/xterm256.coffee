util = require 'util'

COLOR_NAMES = require("./color_names").COLOR_NAMES

COLOR_CUBE = [ 0x00, 0x5f, 0x87, 0xaf, 0xd7, 0xff ]
GRAY_LINE = [0 ... 24].map (n) -> 8 + 10 * n
ANSI_LINE = [0 ... 16].map (n) ->
  c = if (n & 8) then 0xff else 0x80
  [ (if (n & 1) then c else 0), (if (n & 2) then c else 0), (if (n & 4) then c else 0) ]
# two special cases
ANSI_LINE[8] = ANSI_LINE[7]
ANSI_LINE[7] = [ 0xc0, 0xc0, 0xc0 ]
HEX_RE = /^[\da-fA-F]{3}([\da-fA-F]{3})?$/

cache = {}

# parse a color name, or "#fff" or "#cc0033" into a color index
get_color = (name) ->
  if COLOR_NAMES[name]? then name = COLOR_NAMES[name]
  if name[0] == "#" then name = name[1...]
  if name.match(HEX_RE) then return color_from_hex(name)
  # default to gray
  7

# given a hex like "fff" or "cc0033", return the closest matching color in xterm-256 as an index (0 - 255)
color_from_hex = (hex) ->
  if cache[hex]? then return cache[hex]
  realhex = if hex.length == 3 then hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2] else hex
  [ red, green, blue ] = [ parseInt(realhex[0...2], 16), parseInt(realhex[2...4], 16), parseInt(realhex[4...6], 16) ]
  index = nearest_color(red, green, blue)
  cache[hex] = index
  index

nearest_color = (red, green, blue) ->
  [ cube_index, cube_distance ] = nearest_color_cube(red, green, blue)
  [ gray_index, gray_distance ] = nearest_gray(red, green, blue)
  [ ansi_index, ansi_distance ] = nearest_ansi(red, green, blue)
  if cube_distance < gray_distance and cube_distance < ansi_distance
    16 + cube_index
  else if gray_distance < ansi_distance
    232 + gray_index
  else
    ansi_index

# returns [ index into color cube, distance ]
nearest_color_cube = (red, green, blue) ->
  redi = find_closest(red, COLOR_CUBE)
  greeni = find_closest(green, COLOR_CUBE)
  bluei = find_closest(blue, COLOR_CUBE)
  distance = color_distance(COLOR_CUBE[redi], COLOR_CUBE[greeni], COLOR_CUBE[bluei], red, green, blue)
  [ 36 * redi + 6 * greeni + bluei, distance ]

nearest_gray = (red, green, blue) ->
  gray = (red + green + blue) / 3
  i = find_closest(gray, GRAY_LINE)
  distance = color_distance(GRAY_LINE[i], GRAY_LINE[i], GRAY_LINE[i], red, green, blue)
  [ i, distance ]

nearest_ansi = (red, green, blue) ->
  distances = ANSI_LINE.map ([ r, g, b ]) -> color_distance(r, g, b, red, green, blue)
  i = find_closest(0, distances)
  [ i, distances[i] ]

color_distance = (red1, green1, blue1, red2, green2, blue2) ->
  Math.sqrt(Math.pow(red1 - red2, 2) + Math.pow(green1 - green2, 2) + Math.pow(blue1 - blue2, 2))

# return the index of the element in list that's closest to n.
find_closest = (n, list) ->
  list.map((item, index) -> [ Math.abs(item - n), index ]).sort((a, b) -> a[0] - b[0])[0][1]


exports.get_color = get_color

# for unit tests:
exports.color_from_hex = color_from_hex
exports.nearest_color = nearest_color
exports.nearest_color_cube = nearest_color_cube
exports.nearest_gray = nearest_gray
exports.nearest_ansi = nearest_ansi
