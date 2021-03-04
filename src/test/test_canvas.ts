import { Canvas } from "../antsy/canvas";

import "should";
import "source-map-support/register";

const SET_BG_BLACK = "[[48;5;16m";
const RESET_COLOR = "[[37m" + SET_BG_BLACK;
const CLEAR = "[[2J[[H";
const RESET = RESET_COLOR + CLEAR;
const SET_FG_GREEN = "[[32m";
const SET_FG_RED = "[[38;5;9m";
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
    escpaint(c).should.eql(`${RESET} ${SET_FG_GREEN}wh${SET_BG_BLUE}ut[[H`);
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
    escpaint(c).should.eql(`${RESET}hi[[6Cok[[2Bcat[[H`);
    escpaint(c).should.eql("");
    r.at(0, 0).write("hi");
    escpaint(c).should.eql("");
  });

  it("honors clipping", () => {
    const c = new Canvas(15, 3);
    const r = c.clip(5, 1, 10, 3);
    r.at(0, 0).color("purple").write("midnight");
    escpaint(c).should.eql(`${RESET}[[2;6H[[35mmidni[[3;6Hght[[H`);
  });

  it("clips around linefeeds", () => {
    const c = new Canvas(15, 3);
    const r = c.clip(0, 1, 15, 3);
    r.at(0, 0).color("purple").write("one\ntwo\nthree");
    escpaint(c).should.eql(`${RESET}[[B[[35mtwo[[3Hthree[[H`);
  });

  describe("uses clear-to-EOL while painting", () => {
    it("in the middle", () => {
      const c = new Canvas(15, 3);
      const r = c.all();
      r.at(0, 0).write("random words!");
      escpaint(c).should.eql(`${RESET}random words![[13D`);
      r.at(3, 0).write("         ?");
      escpaint(c).should.eql(`[[3C[[K[[9C?[[13D`);
    });

    it("at the start", () => {
      const c = new Canvas(15, 3);
      const r = c.all();
      r.at(0, 0).write("random-words!");
      escpaint(c).should.eql(`${RESET}random-words![[13D`);
      r.at(0, 0).color(4).write("           ?");
      escpaint(c).should.eql(`[[K[[11C[[34m?[[37m![[13D`);
    });

    it("at the end", () => {
      const c = new Canvas(15, 3);
      const r = c.all();
      r.at(0, 0).write("random words!");
      escpaint(c).should.eql(`${RESET}random words![[13D`);
      r.at(3, 0).write("          ");
      escpaint(c).should.eql(`[[3C[[K[[3D`);
    });

    it("around the middle", () => {
      const c = new Canvas(30, 3);
      const r = c.all();
      r.at(0, 0).write("012345678901234567890123456789");
      escpaint(c).should.eql(`${RESET}012345678901234567890123456789[[H`);
      r.backgroundColor(2).clip(0, 0, 30, 1).clear();
      r.at(10, 0).backgroundColor(5).write("          ");
      escpaint(c).should.eql("[[42m[[K[[10C[[45m          [[20D");
    });

    it("three times", () => {
      const c = new Canvas(35, 3);
      const r = c.all();
      r.at(0, 0).write("01234567890123456789012345678901234");
      escpaint(c).should.eql(`${RESET}01234567890123456789012345678901234[[H`);
      r.backgroundColor(2).clip(0, 0, 35, 1).clear();
      r.at(8, 0).backgroundColor(5).write("                ");
      escpaint(c).should.eql("[[42m[[K[[8C[[45m[[K[[16C[[42m[[K[[24D");
    });

    it("degenerate case", () => {
      const c = new Canvas(105, 3);
      const r = c.all();
      r.at(0, 0);
      r.color(4, 0).write("       Entrance to: ")
      r.color(5, 2).write("dominic/treehouse   ")
      r.color(5, 2).write("          ");
      r.color(4, 0).write(" Dom's Treehouse")
      r.at(104, 0).color(11, 2).write("*");
      escpaint(c).should.eql(
        `${RESET}[[7C[[34mEntrance to: [[35m[[42mdominic/treehouse             ` +
        `${SET_BG_BLACK} [[34mDom's Treehouse[[38C[[38;5;11m[[42m*[[H`
      );

      r.at(0, 0);
      r.color(4, 0).write("                    ");
      r.color(5, 2).write("tree house          ");
      r.color(5, 2).write("                    ");
      r.color(4, 0).write("        ");
      r.at(104, 0).color(11, 2).write("*");
      escpaint(c).should.eql(
        `[[7C${SET_BG_BLACK}             [[35m[[42mtree house       [[13C          ` +
        `${SET_BG_BLACK}      [[66D`
      );
    });
  });

  it("clears a region", () => {
    const c = new Canvas(10, 10);
    for (let y = 0; y < 10; y++) c.all().at(0, y).write("##########");
    escpaint(c);
    c.clip(3, 3, 9, 7).clear();
    escpaint(c).should.eql("[[4;4H      [[5;4H      [[6;4H      [[7;4H      [[H");
  });

  it("writes canvas into each other", () => {
    // make a background and a box, and draw them into the main canvas to simulate animation.
    const c = new Canvas(10, 10);
    const bg = new Canvas(10, 10);
    const box = new Canvas(4, 4);
    bg.all().backgroundColor("navy").clear();
    box.all().backgroundColor("maroon").clear().at(0, 0).color("white").write("+--+|  ||  |+--+");

    c.all().draw(bg.all());
    c.clip(3, 3, 10, 10).draw(box.all());
    escpaint(c).should.eql(
      `${RESET}[[44m[[K[[B[[K[[B[[K[[B` +
      `   [[38;5;15m[[41m+--+[[44m   ` +
      `[[5H   [[41m|  |[[44m   ` +
      `[[6H   [[41m|  |[[44m   ` +
      `[[7H   [[41m+--+[[44m   ` +
      `[[8H[[K[[B[[K[[B[[K[[9A`
    );

    // move the box one place over, but "redraw" everything
    c.all().draw(bg.all());
    c.clip(4, 4, 10, 10).draw(box.all());
    escpaint(c).should.eql(
      `[[3B[[K` +
      `[[5;4H [[41m+--+` +
      `[[6;4H[[44m [[41m|  |` +
      `[[7;4H[[44m [[41m|  |` +
      `[[8;5H+--+[[H`
    );

    // move the box one place back, using the cursor instead of the clip region
    c.all().draw(bg.all());
    c.all().at(3, 3).draw(box.all());
    escpaint(c).should.eql(
      `[[4;4H+--+` +
      `[[5;4H|  |[[44m ` +
      `[[6;4H[[41m|  |[[44m ` +
      `[[7;4H[[41m+--+[[44m ` +
      `[[8H[[K[[7A`
    );
  });

  it("places the cursor", () => {
    const c = new Canvas(10, 10);
    c.all().at(0, 4).write(">").at(0, 3).write("Ready.").moveCursor(2, 4);
    escpaint(c).should.eql(`${RESET}[[3BReady.[[5H>[[C`);
  });

  it("clears to end of line in clip region", () => {
    const c = new Canvas(10, 4);
    for (let y = 0; y < 4; y++) c.all().at(0, y).write(y.toString());

    const r = c.clip(0, 2, 10, 4);
    r.at(0, 1).clearToEndOfLine();

    escpaint(c).should.eql(`${RESET}0[[2H1[[3H2[[H`);
  });

  it("resizes", () => {
    const c = new Canvas(10, 10);
    c.all().color("00f").at(5, 3).write("hello");
    c.all().color("f00").at(0, 9).write("ok");
    escpaint(c).should.eql(`${RESET}[[4;6H[[38;5;12mhello[[10H[[38;5;9mok[[H`);

    c.resize(8, 11);
    escpaint(c).should.eql(`${RESET}[[4;6H[[38;5;12mhel[[10H[[38;5;9mok[[H`);
  });

  it("redraws", () => {
    const c = new Canvas(10, 10);
    c.all().color("00f").at(5, 3).write("hello");
    c.all().color("f00").at(0, 9).write("ok");
    escpaint(c).should.eql(`${RESET}[[4;6H[[38;5;12mhello[[10H[[38;5;9mok[[H`);

    c.redraw();
    escpaint(c).should.eql(
      `${RESET}${SET_BG_BLACK}[[K[[B[[K[[B[[K[[B     [[38;5;12mhello` +
      `[[5H[[K[[B[[K[[B[[K[[B[[K[[B[[K[[B[[38;5;9mok[[K[[H`
    );
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
      escpaint(c).should.eql(`${RESET}*******[[2H*     *[[3H*first*[[4H*secnd*[[5H*third*[[6H*     *[[7H*******[[H`);
      return c;
    }

    it("up", () => {
      const c = stars();
      c.all().scrollUp(2);
      escpaint(c).should.eql("[[1;7r[[2S[[r[[H");
    });

    it("up region", () => {
      const c = stars();
      c.clip(1, 1, 6, 6).scrollUp(2);
      escpaint(c).should.eql("[[2;6r[[2S[[r[[5H*     *[[6H*     *[[H");
    });

    it("down", () => {
      const c = stars();
      c.all().scrollDown(2);
      escpaint(c).should.eql("[[1;7r[[2T[[r[[H");
    });

    it("down region", () => {
      const c = stars();
      c.clip(1, 1, 6, 6).scrollDown(2);
      escpaint(c).should.eql("[[2;6r[[2T[[r[[2H*     *[[3H*     *[[H");
    });

    it("left", () => {
      const c = stars();
      c.all().scrollLeft(2);
      escpaint(c).should.eql("*****  [[2H    *  [[3Hirst*  [[4Hecnd*  [[5Hhird*  [[6H    *  [[7;6H  [[H");
    });

    it("left region", () => {
      const c = stars();
      c.clip(1, 1, 6, 6).scrollLeft(2);
      escpaint(c).should.eql("[[3;2Hrst  [[4;2Hcnd  [[5;2Hird  [[H");
    });

    it("right", () => {
      const c = stars();
      c.all().scrollRight(2);
      escpaint(c).should.eql("  [[2H  *    [[3H  *firs[[4H  *secn[[5H  *thir[[6H  *    [[7H  [[H");
    });

    it("right region", () => {
      const c = stars();
      c.clip(1, 1, 6, 6).scrollRight(2);
      escpaint(c).should.eql("[[3;2H  fir[[4;2H  sec[[5;2H  thi[[H");
    });

    it("on overflow", () => {
      const c = new Canvas(5, 3);
      c.all().at(0, 2).write("hi");
      escpaint(c).should.eql(`${RESET}[[2Bhi[[H`);
      c.all().at(2, 2).write("tops");
      escpaint(c).should.eql("[[Bhitop[[3Hs [[H");
    });
  });
});
