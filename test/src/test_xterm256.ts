import * as xterm256 from "../../src/antsy/xterm256";

import "should";

describe("xterm256", () => {
  describe("finds the nearest", () => {
    it("color cube", () => {
      xterm256.nearest_color_cube(0, 0, 0).should.eql([ 0, 0 ]);
      xterm256.nearest_color_cube(47, 47, 47).should.eql([ 0, Math.sqrt(3 * 47 * 47) ]);
      xterm256.nearest_color_cube(48, 48, 48).should.eql([ 1 * 36 + 1 * 6 + 1, Math.sqrt(3 * 47 * 47) ]);
      xterm256.nearest_color_cube(255, 140, 2).should.eql([ 5 * 36 + 2 * 6 + 0, Math.sqrt(5 * 5 + 2 * 2) ]);
      xterm256.nearest_color_cube(127, 0, 250).should.eql([ 2 * 36 + 0 * 6 + 5, Math.sqrt(8 * 8 + 5 * 5) ]);
      xterm256.nearest_color_cube(255, 255, 255).should.eql([ 5 * 36 + 5 * 6 + 5, 0 ]);
    });

    it("gray", () => {
      xterm256.nearest_gray(0, 0, 0).should.eql([ 0, Math.sqrt(3 * 8 * 8) ]);
      xterm256.nearest_gray(18, 18, 18).should.eql([ 1, 0 ]);
      xterm256.nearest_gray(17, 19, 20).should.eql([ 1, Math.sqrt(1 + 1 + 4) ]);
      xterm256.nearest_gray(255, 255, 255).should.eql([ 23, Math.sqrt(3 * 17 * 17) ]);
      xterm256.nearest_gray(127, 127, 127).should.eql([ 12, Math.sqrt(3) ]);
      xterm256.nearest_gray(0, 128, 64).should.eql([ 6, Math.sqrt(68 * 68 + 60 * 60 + 4 * 4) ]);
    });

    it("ansi color", () => {
      xterm256.nearest_ansi(0, 0, 0).should.eql([ 0, 0 ]);
      xterm256.nearest_ansi(0xc0, 0xc0, 0xc0).should.eql([ 7, 0 ]);
      xterm256.nearest_ansi(250, 250, 250).should.eql([ 15, Math.sqrt(3 * 5 * 5) ]);
      xterm256.nearest_ansi(64, 32, 200).should.eql([ 12, Math.sqrt(64 * 64 + 32 * 32 + 55 * 55) ]);
    });

    it("color, in general", () => {
      xterm256.nearest_color(0, 0, 0).should.eql(0);
      xterm256.nearest_color(12, 12, 12).should.eql(232); // 080808
      xterm256.nearest_color(127, 127, 0).should.eql(3);
      xterm256.nearest_color(133, 133, 0).should.eql(100); // 878700
      xterm256.nearest_color(250, 40, 100).should.eql(197); // ff005f
      xterm256.nearest_color(217, 217, 217).should.eql(253); // dadada
      xterm256.nearest_color(216, 216, 216).should.eql(188); // d7d7d7
    });

    it("color, from hex", () => {
      xterm256.color_from_hex("000").should.eql(0);
      xterm256.color_from_hex("000000").should.eql(0);
      xterm256.color_from_hex("ccc").should.eql(252); // d0d0d0
      xterm256.color_from_hex("0c0c0c").should.eql(232); // 080808
      xterm256.color_from_hex("7f7f00").should.eql(3);
      xterm256.color_from_hex("858500").should.eql(100); // 878700
      xterm256.color_from_hex("fa2864").should.eql(197); // ff005f
      xterm256.color_from_hex("d9d9d9").should.eql(253); // dadada
      xterm256.color_from_hex("d8d8d8").should.eql(188); // d7d7d7
    });

    it("color by name", () => {
      xterm256.get_color("blue").should.eql(12);
      xterm256.get_color("gray").should.eql(8);
      xterm256.get_color("#000").should.eql(0);
      xterm256.get_color("wuh").should.eql(7);
      xterm256.get_color("black").should.eql(0);
    });
  });
});
