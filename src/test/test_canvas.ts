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
    c.all().at(1, 0).color("green").write("wh").color(undefined, "00f").write("ut");
    escpaint(c).should.eql(`${RESET} ${SET_FG_GREEN}wh${SET_BG_BLUE}ut`);
  });

  it("clears", () => {
    const c = new Canvas(5, 3);
    c.all().color("red", "blue").clear();
    escpaint(c).should.eql(`${SET_FG_RED}${SET_BG_BLUE}${CLEAR}`);
  });

  it("skips unchanged", () => {
    const c = new Canvas(15, 3);
    const r = c.all();
    r.at(0, 0).write("hi");
    r.at(8, 0).write("ok");
    r.at(10, 2).write("cat");
    escpaint(c).should.eql(`${RESET}hi[[6Cok[[2Bcat`);
    escpaint(c).should.eql("");
    r.at(0, 0).write("hi");
    escpaint(c).should.eql("");
  });

  describe("uses clear-to-EOL while painting", () => {
    it("in the middle", () => {
      const c = new Canvas(15, 3);
      const r = c.all();
      r.at(0, 0).write("random words!");
      escpaint(c).should.eql(`${RESET}random words!`);
      r.at(3, 0).write("         ?");
      escpaint(c).should.eql(`[[10D[[K[[9C?`);
    });

    it("at the start", () => {
      const c = new Canvas(15, 3);
      const r = c.all();
      r.at(0, 0).write("random-words!");
      escpaint(c).should.eql(`${RESET}random-words!`);
      r.at(0, 0).color(4).write("           ?");
      escpaint(c).should.eql(`[[13D[[34m[[K[[11C?[[37m!`);
    });

    it("at the end", () => {
      const c = new Canvas(15, 3);
      const r = c.all();
      r.at(0, 0).write("random words!");
      escpaint(c).should.eql(`${RESET}random words!`);
      r.at(3, 0).write("          ");
      escpaint(c).should.eql(`[[10D[[K`);
    });

    it("around the middle", () => {
      const c = new Canvas(30, 3);
      const r = c.all();
      r.at(0, 0).write("012345678901234567890123456789");
      escpaint(c).should.eql(`${RESET}012345678901234567890123456789`);
      r.at(0, 0).color(undefined, 2).clearToEndOfLine();
      r.at(10, 0).color(undefined, 5).write("          ");
      escpaint(c).should.eql("[[30D[[42m[[K[[10C[[45m          ");
    });

    it("three times", () => {
      const c = new Canvas(35, 3);
      const r = c.all();
      r.at(0, 0).write("01234567890123456789012345678901234");
      escpaint(c).should.eql(`${RESET}01234567890123456789012345678901234`);
      r.at(0, 0).color(undefined, 2).clearToEndOfLine();
      r.at(8, 0).color(undefined, 5).write("                ");
      escpaint(c).should.eql("[[35D[[42m[[K[[8C[[45m[[K[[16C[[42m[[K");
    });
  });

  it("clears a region", () => {
    const c = new Canvas(10, 10);
    for (let y = 0; y < 10; y++) c.all().at(0, y).write("##########");
    escpaint(c);
    c.clip(3, 3, 9, 7).clear();
    escpaint(c).should.eql("[[4;4H      [[5;4H      [[6;4H      [[7;4H      ");
  });


  describe("scrolls", () => {
    function stars(): Canvas {
      const c = new Canvas(7, 7);
      const r = c.all();
      r.at(0, 0).write("*******");
      for (let y = 1; y < 6; y++) {
        r.at(0, y).write("*");
        r.at(6, y).write("*");
      }
      r.at(0, 6).write("*******");
      r.at(1, 2).write("first");
      r.at(1, 3).write("secnd");
      r.at(1, 4).write("third");
      escpaint(c).should.eql(`${RESET}*******[[2H*     *[[3H*first*[[4H*secnd*[[5H*third*[[6H*     *[[7H*******`);
      return c;
    }

    it("up", () => {
      const c = stars();
      c.all().scrollUp(2);
      escpaint(c).should.eql("[[1;7r[[2S[[r");
    });

    it("up region", () => {
      const c = stars();
      c.clip(1, 1, 6, 6).scrollUp(2);
      escpaint(c).should.eql("[[2;6r[[2S[[r[[5H*     *[[6H*     *");
    });

    it("down", () => {
      const c = stars();
      c.all().scrollDown(2);
      escpaint(c).should.eql("[[1;7r[[2T[[r");
    });

    it("down region", () => {
      const c = stars();
      c.clip(1, 1, 6, 6).scrollDown(2);
      escpaint(c).should.eql("[[2;6r[[2T[[r[[2H*     *[[3H*     *");
    });

    it("left", () => {
      const c = stars();
      c.all().scrollLeft(2);
      escpaint(c).should.eql("[[1;6H  [[2H    *  [[3Hirst*  [[4Hecnd*  [[5Hhird*  [[6H    *  [[7;6H  ");
    });

    it("left region", () => {
      const c = stars();
      c.clip(1, 1, 6, 6).scrollLeft(2);
      escpaint(c).should.eql("[[3;2Hrst  [[4;2Hcnd  [[5;2Hird  ");
    });

    it("right", () => {
      const c = stars();
      c.all().scrollRight(2);
      escpaint(c).should.eql("[[H  [[2H  *    [[3H  *firs[[4H  *secn[[5H  *thir[[6H  *    [[7H  ");
    });

    it("right region", () => {
      const c = stars();
      c.clip(1, 1, 6, 6).scrollRight(2);
      escpaint(c).should.eql("[[3;2H  fir[[4;2H  sec[[5;2H  thi");
    });

    it("on overflow", () => {
      const c = new Canvas(5, 3);
      c.all().at(0, 2).write("hi");
      escpaint(c).should.eql(`${RESET}[[2Bhi`);
      c.all().at(2, 2).write("tops");
      escpaint(c).should.eql("[[2Hhitop[[3Hs ");
    });
  });
});
