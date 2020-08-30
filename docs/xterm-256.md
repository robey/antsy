xterm-256 color table
=====================

Xterm-256 colors are broken into 3 groups:

- 0x00 - 0x0f: 16 basic ANSI colors, from MS-DOS days
- 0x10 - 0xe7: 6x6x6 color cube
- 0xe8 - 0xff: 24 gradients of gray

ANSI colors
-----------

The ansi color table uses a 4-bit IBGR scheme, where I is "intensity". The
colors are either off (0x00) or on (0x80).

If the intensity bit is set, all colors at 0x80 become 0xff.

There are two exceptions:

- 0x07: "non-intense white" or "dull white" is 0xc0c0c0 (not 0x808080)
- 0x08: "intense black" or "bright black" is 0x808080 (not 0x000000)

Color cube
----------

Unlike the netscape color cube, the xterm-256 color cube is weighted toward
brighter colors, with more fidelity in the visible range. The encoding is a
base-6 RGB, with the 6 values being:

- 0x00 (0)
- 0x5f (95) +95
- 0x87 (135) +40
- 0xaf (175) +40
- 0xd7 (215) +40
- 0xff (255) +40

Grays
-----

All 24 grays use the same value for red, green, and blue. The lowest value is
8 (0x080808), with each subsequent color +10, so that the 24th is 8 + 10 * 23
or 238 (0xeeeeee).

Notes
-----

The grays have a gap of 17 at the top, which could be explained if the
original author had an off-by-one error and assumed there would be space for
one more color (248, 0xf8f8f8) to make an even distribution.

There's no redundancy between the grays and the color cube, so there are 30
grays overall, with a scattered distribution.

The ANSI colors duplicate several of the color cube entries and one gray.

Source
------

http://www.calmar.ws/vim/256-xterm-24bit-rgb-color-chart.html
