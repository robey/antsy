import * as canvas from "../../src/antsy/canvas";

import "should";

const WHITE_ON_BLACK = "\u001b[48;5;0m\u001b[38;5;15m";
const GREEN_ON_BLACK = "\u001b[48;5;0m\u001b[38;5;2m";
const BLACK_ON_BLACK = "\u001b[48;5;0m\u001b[38;5;0m";
const SET_FG_GREEN = "\u001b[38;5;2m";
const SET_FG_RED = "\u001b[38;5;9m";
const SET_FG_BLACK = "\u001b[38;5;0m";
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

  it("clears", () => {
    const c = new canvas.Canvas(5, 3);
    c.backgroundColor("blue").color("red").clear();
    c.toStrings().should.eql([
      `${SET_BG_BLUE}${SET_FG_RED}     ${RESET}`,
      `${SET_BG_BLUE}${SET_FG_RED}     ${RESET}`,
      `${SET_BG_BLUE}${SET_FG_RED}     ${RESET}`
    ]);
  });

  describe("scrolls", () => {
    function xyq() {
      const c = new canvas.Canvas(5, 5);
      c.color("green").clear();
      c.at(2, 2).write("X");
      c.at(3, 3).write("Y");
      c.at(1, 1).write("Q");
      return c;
    }

    it("up", () => {
      const c = xyq();
      c.scroll(0, 2);
      c.toStrings().should.eql([
        `${GREEN_ON_BLACK}  X  ${RESET}`,
        `${GREEN_ON_BLACK}   Y ${RESET}`,
        `${GREEN_ON_BLACK}     ${RESET}`,
        `${BLACK_ON_BLACK}     ${RESET}`,
        `${BLACK_ON_BLACK}     ${RESET}`
      ]);
    });

    it("down", () => {
      const c = xyq();
      c.scroll(0, -2);
      c.toStrings().should.eql([
        `${BLACK_ON_BLACK}     ${RESET}`,
        `${BLACK_ON_BLACK}     ${RESET}`,
        `${GREEN_ON_BLACK}     ${RESET}`,
        `${GREEN_ON_BLACK} Q   ${RESET}`,
        `${GREEN_ON_BLACK}  X  ${RESET}`
      ]);
    });

    it("left", () => {
      const c = xyq();
      c.scroll(2, 0);
      c.toStrings().should.eql([
        `${GREEN_ON_BLACK}   ${SET_FG_BLACK}  ${RESET}`,
        `${GREEN_ON_BLACK}   ${SET_FG_BLACK}  ${RESET}`,
        `${GREEN_ON_BLACK}X  ${SET_FG_BLACK}  ${RESET}`,
        `${GREEN_ON_BLACK} Y ${SET_FG_BLACK}  ${RESET}`,
        `${GREEN_ON_BLACK}   ${SET_FG_BLACK}  ${RESET}`
      ]);
    });

    it("right", () => {
      const c = xyq();
      c.scroll(-2, 0);
      c.toStrings().should.eql([
        `${BLACK_ON_BLACK}  ${SET_FG_GREEN}   ${RESET}`,
        `${BLACK_ON_BLACK}  ${SET_FG_GREEN} Q ${RESET}`,
        `${BLACK_ON_BLACK}  ${SET_FG_GREEN}  X${RESET}`,
        `${BLACK_ON_BLACK}  ${SET_FG_GREEN}   ${RESET}`,
        `${BLACK_ON_BLACK}  ${SET_FG_GREEN}   ${RESET}`
      ]);
    });

    it("up and right", () => {
      const c = xyq();
      c.scroll(-1, 1);
      c.toStrings().should.eql([
        `${BLACK_ON_BLACK} ${SET_FG_GREEN} Q  ${RESET}`,
        `${BLACK_ON_BLACK} ${SET_FG_GREEN}  X ${RESET}`,
        `${BLACK_ON_BLACK} ${SET_FG_GREEN}   Y${RESET}`,
        `${BLACK_ON_BLACK} ${SET_FG_GREEN}    ${RESET}`,
        `${BLACK_ON_BLACK}     ${RESET}`
      ]);
    });
  });
});
