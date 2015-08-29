const color_names = require("./color_names")
const util = require("util");

const COLOR_NAMES = color_names.COLOR_NAMES;

const COLOR_CUBE = [ 0x00, 0x5f, 0x87, 0xaf, 0xd7, 0xff ];
const GRAY_LINE = [];
const ANSI_LINE = [];

for (let i = 0; i < 24; i++) GRAY_LINE[i] = 8 + 10 * i;
for (let i = 0; i < 16; i++) {
  const c = (i & 8) ? 0xff : 0x80;
  ANSI_LINE[i] = [
    (i & 1) ? c : 0,
    (i & 2) ? c : 0,
    (i & 4) ? c : 0
  ];
}

// two special cases
ANSI_LINE[8] = ANSI_LINE[7];
ANSI_LINE[7] = [ 0xc0, 0xc0, 0xc0 ];

const HEX_RE = /^[\da-fA-F]{3}([\da-fA-F]{3})?$/;

const cache = {};

// parse a color name, or "#fff" or "#cc0033" into a color index
function get_color(name) {
  if (COLOR_NAMES[name]) name = COLOR_NAMES[name];
  if (name[0] == "#") name = name.slice(1);
  if (name.match(HEX_RE)) return color_from_hex(name);
  // default to gray
  return 7;
}

// given a hex like "fff" or "cc0033", return the closest matching color in xterm-256 as an index (0 - 255)
function color_from_hex(hex) {
  if (cache[hex] != null) return cache[hex];
  const realhex = hex.length == 3 ? hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2] : hex;
  const [ red, green, blue ] = [
    parseInt(realhex.slice(0, 2), 16),
    parseInt(realhex.slice(2, 4), 16),
    parseInt(realhex.slice(4, 6), 16)
  ];
  const index = nearest_color(red, green, blue);
  cache[hex] = index;
  return index;
}

function nearest_color(red, green, blue) {
  const [ cube_index, cube_distance ] = nearest_color_cube(red, green, blue);
  const [ gray_index, gray_distance ] = nearest_gray(red, green, blue);
  const [ ansi_index, ansi_distance ] = nearest_ansi(red, green, blue);
  if (cube_distance < gray_distance && cube_distance < ansi_distance) {
    return 16 + cube_index;
  } else if (gray_distance < ansi_distance) {
    return 232 + gray_index;
  } else {
    return ansi_index;
  }
}

// returns [ index into color cube, distance ]
function nearest_color_cube(red, green, blue) {
  const redi = find_closest(red, COLOR_CUBE);
  const greeni = find_closest(green, COLOR_CUBE);
  const bluei = find_closest(blue, COLOR_CUBE);
  const distance = color_distance(COLOR_CUBE[redi], COLOR_CUBE[greeni], COLOR_CUBE[bluei], red, green, blue);
  return [ 36 * redi + 6 * greeni + bluei, distance ];
}

function nearest_gray(red, green, blue) {
  const gray = (red + green + blue) / 3;
  const i = find_closest(gray, GRAY_LINE);
  const distance = color_distance(GRAY_LINE[i], GRAY_LINE[i], GRAY_LINE[i], red, green, blue);
  return [ i, distance ];
}

function nearest_ansi(red, green, blue) {
  const distances = ANSI_LINE.map(([ r, g, b ]) => color_distance(r, g, b, red, green, blue) );
  const i = find_closest(0, distances);
  return [ i, distances[i] ];
}

function color_distance(red1, green1, blue1, red2, green2, blue2) {
  return Math.sqrt(Math.pow(red1 - red2, 2) + Math.pow(green1 - green2, 2) + Math.pow(blue1 - blue2, 2));
}

// return the index of the element in list that's closest to n.
function find_closest(n, list) {
  return list.map((item, index) => [ Math.abs(item - n), index ]).sort((a, b) => a[0] - b[0])[0][1];
}


exports.get_color = get_color;

// for unit tests:
exports.color_from_hex = color_from_hex;
exports.nearest_color = nearest_color;
exports.nearest_color_cube = nearest_color_cube;
exports.nearest_gray = nearest_gray;
exports.nearest_ansi = nearest_ansi;
