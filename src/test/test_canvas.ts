import { Canvas } from "../antsy/canvas2";

import "should";

const RESET_COLOR = "[[37m[[40m";
const CLEAR = "[[2J[[H";
const RESET = RESET_COLOR + CLEAR;
// const WHITE_ON_BLACK = "\u001b[48;5;0m\u001b[38;5;15m";
// const GREEN_ON_BLACK = "\u001b[48;5;0m\u001b[38;5;2m";
// const BLACK_ON_BLACK = "\u001b[48;5;0m\u001b[38;5;0m";
const SET_FG_GREEN = "[[32m";
const SET_FG_RED = "[[38;5;9m";
// const SET_FG_BLACK = "\u001b[38;5;0m";
const SET_BG_BLUE = "[[48;5;12m";

const escpaint = (c: Canvas): string => c.paint().replace(/\u001b/g, "[");

describe("Canvas", () => {
  it("makes a blank grid", () => {
    const c = new Canvas(3, 3);
    escpaint(c).should.eql(`${RESET}`);
  });

  it("sets colors", () => {
    const c = new Canvas(5, 3);
    c.at(1, 0).color("green").write("wh").color(undefined, "00f").write("ut");
    escpaint(c).should.eql(`${RESET} ${SET_FG_GREEN}wh${SET_BG_BLUE}ut`);
  });

  it("clears", () => {
    const c = new Canvas(5, 3);
    c.color("red", "blue").clear();
    escpaint(c).should.eql(`${SET_FG_RED}${SET_BG_BLUE}${CLEAR}`);
  });

  it("skips unchanged", () => {
    const c = new Canvas(15, 3);
    c.at(0, 0).write("hi");
    c.at(8, 0).write("ok");
    c.at(10, 2).write("cat");
    escpaint(c).should.eql(`${RESET}hi[[6Cok[[2Bcat`);
  });

  describe("uses clear-to-EOL while painting", () => {
    it("in the middle", () => {
      const c = new Canvas(15, 3);
      c.at(0, 0).write("random words!");
      escpaint(c).should.eql(`${RESET}random words!`);
      c.at(3, 0).write("         ?");
      escpaint(c).should.eql(`[[10D[[K[[9C?`);
    });

    it("at the start", () => {
      const c = new Canvas(15, 3);
      c.at(0, 0).write("random words!");
      escpaint(c).should.eql(`${RESET}random words!`);
      c.at(0, 0).color(4).write("           ?");
      escpaint(c).should.eql(`[[13D[[34m[[K[[11C?[[37m!  `);
    });

    it("at the end", () => {
      const c = new Canvas(15, 3);
      c.at(0, 0).write("random words!");
      escpaint(c).should.eql(`${RESET}random words!`);
      c.at(3, 0).write("          ");
      escpaint(c).should.eql(`[[10D[[K`);
    });

  });

  // describe("scrolls", () => {
  //   function xyq() {
  //     const c = new canvas.Canvas(5, 5);
  //     c.color("green").clear();
  //     c.at(2, 2).write("X");
  //     c.at(3, 3).write("Y");
  //     c.at(1, 1).write("Q");
  //     return c;
  //   }

  //   it("up", () => {
  //     const c = xyq();
  //     c.scroll(0, 2);
  //     c.toStrings().should.eql([
  //       `${GREEN_ON_BLACK}  X  ${RESET}`,
  //       `${GREEN_ON_BLACK}   Y ${RESET}`,
  //       `${GREEN_ON_BLACK}     ${RESET}`,
  //       `${BLACK_ON_BLACK}     ${RESET}`,
  //       `${BLACK_ON_BLACK}     ${RESET}`
  //     ]);
  //   });

  //   it("down", () => {
  //     const c = xyq();
  //     c.scroll(0, -2);
  //     c.toStrings().should.eql([
  //       `${BLACK_ON_BLACK}     ${RESET}`,
  //       `${BLACK_ON_BLACK}     ${RESET}`,
  //       `${GREEN_ON_BLACK}     ${RESET}`,
  //       `${GREEN_ON_BLACK} Q   ${RESET}`,
  //       `${GREEN_ON_BLACK}  X  ${RESET}`
  //     ]);
  //   });

  //   it("left", () => {
  //     const c = xyq();
  //     c.scroll(2, 0);
  //     c.toStrings().should.eql([
  //       `${GREEN_ON_BLACK}   ${SET_FG_BLACK}  ${RESET}`,
  //       `${GREEN_ON_BLACK}   ${SET_FG_BLACK}  ${RESET}`,
  //       `${GREEN_ON_BLACK}X  ${SET_FG_BLACK}  ${RESET}`,
  //       `${GREEN_ON_BLACK} Y ${SET_FG_BLACK}  ${RESET}`,
  //       `${GREEN_ON_BLACK}   ${SET_FG_BLACK}  ${RESET}`
  //     ]);
  //   });

  //   it("right", () => {
  //     const c = xyq();
  //     c.scroll(-2, 0);
  //     c.toStrings().should.eql([
  //       `${BLACK_ON_BLACK}  ${SET_FG_GREEN}   ${RESET}`,
  //       `${BLACK_ON_BLACK}  ${SET_FG_GREEN} Q ${RESET}`,
  //       `${BLACK_ON_BLACK}  ${SET_FG_GREEN}  X${RESET}`,
  //       `${BLACK_ON_BLACK}  ${SET_FG_GREEN}   ${RESET}`,
  //       `${BLACK_ON_BLACK}  ${SET_FG_GREEN}   ${RESET}`
  //     ]);
  //   });

  //   it("up and right", () => {
  //     const c = xyq();
  //     c.scroll(-1, 1);
  //     c.toStrings().should.eql([
  //       `${BLACK_ON_BLACK} ${SET_FG_GREEN} Q  ${RESET}`,
  //       `${BLACK_ON_BLACK} ${SET_FG_GREEN}  X ${RESET}`,
  //       `${BLACK_ON_BLACK} ${SET_FG_GREEN}   Y${RESET}`,
  //       `${BLACK_ON_BLACK} ${SET_FG_GREEN}    ${RESET}`,
  //       `${BLACK_ON_BLACK}     ${RESET}`
  //     ]);
  //   });
  // });
});
