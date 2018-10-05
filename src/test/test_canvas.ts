import { Canvas } from "../antsy/canvas2";

import "should";
import "source-map-support/register";

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
    escpaint(c).should.eql("");
    c.at(0, 0).write("hi");
    escpaint(c).should.eql("");
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
      c.at(0, 0).write("random-words!");
      escpaint(c).should.eql(`${RESET}random-words!`);
      c.at(0, 0).color(4).write("           ?");
      escpaint(c).should.eql(`[[13D[[34m[[K[[11C?[[37m!`);
    });

    it("at the end", () => {
      const c = new Canvas(15, 3);
      c.at(0, 0).write("random words!");
      escpaint(c).should.eql(`${RESET}random words!`);
      c.at(3, 0).write("          ");
      escpaint(c).should.eql(`[[10D[[K`);
    });

    it("around the middle", () => {
      const c = new Canvas(30, 3);
      c.at(0, 0).write("012345678901234567890123456789");
      escpaint(c).should.eql(`${RESET}012345678901234567890123456789`);
      c.at(0, 0).color(undefined, 2).clearToEndOfLine();
      c.at(10, 0).color(undefined, 5).write("          ");
      escpaint(c).should.eql("[[30D[[42m[[K[[10C[[45m          ");
    });

    it("three times", () => {
      const c = new Canvas(35, 3);
      c.at(0, 0).write("01234567890123456789012345678901234");
      escpaint(c).should.eql(`${RESET}01234567890123456789012345678901234`);
      c.at(0, 0).color(undefined, 2).clearToEndOfLine();
      c.at(8, 0).color(undefined, 5).write("                ");
      escpaint(c).should.eql("[[35D[[42m[[K[[8C[[45m[[K[[16C[[42m[[K");
    });
  });

  describe("scrolls", () => {
    function stars(): Canvas {
      const c = new Canvas(7, 7);
      c.at(0, 0).write("*******");
      for (let y = 1; y < 6; y++) {
        c.at(0, y).write("*");
        c.at(6, y).write("*");
      }
      c.at(0, 6).write("*******");
      c.at(1, 2).write("first");
      c.at(1, 3).write("secnd");
      c.at(1, 4).write("third");
      escpaint(c).should.eql(`${RESET}*******[[2H*     *[[3H*first*[[4H*secnd*[[5H*third*[[6H*     *[[7H*******`);
      return c;
    }

    it("up", () => {
      const c = stars();
      c.scrollUp(0, 0, 7, 7, 2);
      escpaint(c).should.eql("[[1;7r[[2S[[r");
    });

    it("up region", () => {
      const c = stars();
      c.scrollUp(1, 1, 6, 6, 2);
      escpaint(c).should.eql("[[2;6r[[2S[[r[[5H*     *[[6H*     *");
    });

    it("down", () => {
      const c = stars();
      c.scrollDown(0, 0, 7, 7, 2);
      escpaint(c).should.eql("[[1;7r[[2T[[r");
    });

    it("down region", () => {
      const c = stars();
      c.scrollDown(1, 1, 6, 6, 2);
      escpaint(c).should.eql("[[2;6r[[2T[[r[[2H*     *[[3H*     *");
    });

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
  });
});
