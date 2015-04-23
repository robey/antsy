const canvas = require("../../lib/antsy/canvas");
const util = require("util");

require("should");

const WHITE_ON_BLACK = "\u001b[48;5;0m\u001b[38;5;15m";
const SET_FG_GREEN = "\u001b[38;5;2m";
const SET_BG_BLUE = "\u001b[48;5;12m";
const RESET = canvas.RESET_ATTRIBUTES;

describe("canvas", () => {
  it("makes a blank grid", () => {
    const c = new canvas.Canvas(3, 3);
    c.toStrings().should.eql([
      `${WHITE_ON_BLACK}   ${RESET}`,
      `${WHITE_ON_BLACK}   ${RESET}`,
      `${WHITE_ON_BLACK}   ${RESET}`
    ]);
  });

  it("sets colors", () => {
    const c = new canvas.Canvas(5, 3);
    c.at(1, 0).color("green").write("wh").backgroundColor("00f").write("ut");
    c.toStrings().should.eql([
      `${WHITE_ON_BLACK} ${SET_FG_GREEN}wh${SET_BG_BLUE}ut${RESET}`,
      `${WHITE_ON_BLACK}     ${RESET}`,
      `${WHITE_ON_BLACK}     ${RESET}`
    ]);
  });
});
