import { COLOR_NAMES } from "./color_names";

// why isn't this part of js?
const range = (start: number, end: number): number[] => {
  const rv = new Array(end - start);
  for (let i = start; i < end; i++) rv[i - start] = i;
  return rv;
};

const COLOR_CUBE = [ 0x00, 0x5f, 0x87, 0xaf, 0xd7, 0xff ];
const GRAY_LINE = range(0, 24).map(i => 8 + 10 * i);
const ANSI_LINE = range(0, 16).map(i => {
  const c = (i & 8) != 0 ? 0xff : 0x80;
  return [
    (i & 1) != 0 ? c : 0,
    (i & 2) != 0 ? c : 0,
    (i & 4) != 0 ? c : 0
  ];
});

const CUBE_OFFSET = 16;
const GRAY_OFFSET = 232;

// two special cases
ANSI_LINE[8] = ANSI_LINE[7];
ANSI_LINE[7] = [ 0xc0, 0xc0, 0xc0 ];

const HEX_RE = /^[\da-fA-F]{3}([\da-fA-F]{3})?$/;

const cache = {};

// parse a color name, or "#fff" or "#cc0033" into a color index
export function get_color(name: string): number {
  if (COLOR_NAMES[name]) name = COLOR_NAMES[name];
  if (name[0] == "#") name = name.slice(1);
  if (name.match(HEX_RE)) return color_from_hex(name);
  // default to gray
  return 7;
}

// given a hex like "fff" or "cc0033", return the closest matching color in xterm-256 as an index (0 - 255)
export function color_from_hex(hex: string): number {
  if (cache[hex] != null) return cache[hex];
  const realhex = hex.length == 3 ? hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2] : hex;
  const [ red, green, blue ] = [
    parseInt(realhex.slice(0, 2), 16),
    parseInt(realhex.slice(2, 4), 16),
    parseInt(realhex.slice(4, 6), 16)
  ] as number[];
  const index = nearest_color(red, green, blue);
  cache[hex] = index;
  return index;
}

export function nearest_color(red: number, green: number, blue: number): number {
  const [ cube_index, cube_distance ] = nearest_color_cube(red, green, blue);
  const [ gray_index, gray_distance ] = nearest_gray(red, green, blue);
  const [ ansi_index, ansi_distance ] = nearest_ansi(red, green, blue);
  if (cube_distance < gray_distance && cube_distance < ansi_distance) {
    return CUBE_OFFSET + cube_index;
  } else if (gray_distance < ansi_distance) {
    return GRAY_OFFSET + gray_index;
  } else {
    return ansi_index;
  }
}

// returns [ index into color cube, distance ]
export function nearest_color_cube(red: number, green: number, blue: number): [ number, number ] {
  const redi = find_closest(red, COLOR_CUBE);
  const greeni = find_closest(green, COLOR_CUBE);
  const bluei = find_closest(blue, COLOR_CUBE);
  const distance = color_distance(COLOR_CUBE[redi], COLOR_CUBE[greeni], COLOR_CUBE[bluei], red, green, blue);
  return [ 36 * redi + 6 * greeni + bluei, distance ];
}

export function nearest_gray(red: number, green: number, blue: number): [ number, number ] {
  const gray = (red + green + blue) / 3;
  const i = find_closest(gray, GRAY_LINE);
  const distance = color_distance(GRAY_LINE[i], GRAY_LINE[i], GRAY_LINE[i], red, green, blue);
  return [ i, distance ];
}

export function nearest_ansi(red: number, green: number, blue: number): [ number, number ] {
  const distances = ANSI_LINE.map(([ r, g, b ]) => color_distance(r, g, b, red, green, blue) );
  const i = find_closest(0, distances);
  return [ i, distances[i] ];
}

function color_distance(
  red1: number, green1: number, blue1: number,
  red2: number, green2: number, blue2: number
): number {
  return Math.sqrt(Math.pow(red1 - red2, 2) + Math.pow(green1 - green2, 2) + Math.pow(blue1 - blue2, 2));
}

// return the index of the element in list that's closest to n.
function find_closest(n: number, list: number[]): number {
  return list.map((item, index) => [ Math.abs(item - n), index ]).sort((a, b) => a[0] - b[0])[0][1];
}
