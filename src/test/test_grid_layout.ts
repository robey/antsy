import { Canvas, Region } from "../antsy/canvas";
import { GridLayout } from "../antsy/grid_layout";

import "should";
import "source-map-support/register";

function dimensions(r: Region): [ number, number, number, number ] {
  return [ r.x1, r.y1, r.cols, r.rows ];
}


describe("GridLayout", () => {
  it("basic layout", () => {
    const c = new Canvas(80, 24);
    // left panel of 8 chars, bottom panel of 2
    const grid = new GridLayout(
      c.all(),
      [ GridLayout.fixed(8), GridLayout.stretch(1) ],
      [ GridLayout.stretch(1), GridLayout.fixed(2) ],
    );
    grid.lefts.should.eql([ 0, 8, 80 ]);
    grid.tops.should.eql([ 0, 22, 24 ]);
    const r1 = grid.layoutAt(0, 0);
    const r2 = grid.layoutAt(1, 0);
    const r3 = grid.layout(0, 1, 2, 2);
    dimensions(r1).should.eql([ 0, 0, 8, 22 ]);
    dimensions(r2).should.eql([ 8, 0, 72, 22 ]);
    dimensions(r3).should.eql([ 0, 22, 80, 2 ]);

    // no room
    c.resize(6, 20);
    grid.lefts.should.eql([ 0, 6, 6 ]);
    grid.tops.should.eql([ 0, 18, 20 ]);
    dimensions(r1).should.eql([ 0, 0, 6, 18 ]);
    dimensions(r2).should.eql([ 6, 0, 0, 18 ]);
    dimensions(r3).should.eql([ 0, 18, 6, 2 ]);
  });

  it("multiple stretch zones", () => {
    const c = new Canvas(80, 24);
    // left panel of 8 chars, bottom panel of 2
    const grid = new GridLayout(
      c.all(),
      [ GridLayout.fixed(8), GridLayout.stretch(2), GridLayout.stretch(1) ],
      [ GridLayout.stretch(1), GridLayout.fixed(2) ],
    );
    grid.lefts.should.eql([ 0, 8, 56, 80 ]);
    grid.tops.should.eql([ 0, 22, 24 ]);
    const r1 = grid.layoutAt(0, 0);
    const r2 = grid.layoutAt(1, 0);
    const r3 = grid.layoutAt(2, 0);
    const r4 = grid.layout(0, 1, 3, 2);
    dimensions(r1).should.eql([ 0, 0, 8, 22 ]);
    dimensions(r2).should.eql([ 8, 0, 48, 22 ]);
    dimensions(r3).should.eql([ 56, 0, 24, 22 ]);
    dimensions(r4).should.eql([ 0, 22, 80, 2 ]);

    // no room
    c.resize(6, 20);
    grid.lefts.should.eql([ 0, 6, 6, 6 ]);
    grid.tops.should.eql([ 0, 18, 20 ]);
    dimensions(r1).should.eql([ 0, 0, 6, 18 ]);
    dimensions(r2).should.eql([ 6, 0, 0, 18 ]);
    dimensions(r3).should.eql([ 6, 0, 0, 18 ]);
    dimensions(r4).should.eql([ 0, 18, 6, 2 ]);

    // fractional column
    c.resize(79, 24);
    grid.lefts.should.eql([ 0, 8, 56, 79 ]);
    grid.tops.should.eql([ 0, 22, 24 ]);
    dimensions(r1).should.eql([ 0, 0, 8, 22 ]);
    dimensions(r2).should.eql([ 8, 0, 48, 22 ]);
    dimensions(r3).should.eql([ 56, 0, 23, 22 ]);
    dimensions(r4).should.eql([ 0, 22, 79, 2 ]);

    c.resize(78, 24);
    grid.lefts.should.eql([ 0, 8, 55, 78 ]);
    grid.tops.should.eql([ 0, 22, 24 ]);
    dimensions(r1).should.eql([ 0, 0, 8, 22 ]);
    dimensions(r2).should.eql([ 8, 0, 47, 22 ]);
    dimensions(r3).should.eql([ 55, 0, 23, 22 ]);
    dimensions(r4).should.eql([ 0, 22, 78, 2 ]);
  });

  it("stretch with minimum", () => {
    const c = new Canvas(60, 24);
    const grid = new GridLayout(
      c.all(),
      [ GridLayout.stretchWithMinimum(1, 8), GridLayout.stretch(2) ],
      [ GridLayout.stretch(1), GridLayout.fixed(2) ],
    );

    grid.lefts.should.eql([ 0, 20, 60 ]);
    grid.tops.should.eql([ 0, 22, 24 ]);

    c.resize(18, 24);
    grid.lefts.should.eql([ 0, 8, 18 ]);
    grid.tops.should.eql([ 0, 22, 24 ]);
  });

  it("several fixed", () => {
    // 10-min sidebar on each side, 1/2 center column, 1/6 right column
    const c = new Canvas(120, 24);
    const grid = new GridLayout(
      c.all(),
      [ GridLayout.stretchWithMinimum(1, 10), GridLayout.stretch(3), GridLayout.stretch(1), GridLayout.stretchWithMinimum(1, 10) ],
      [ GridLayout.stretch(1) ],
    );

    grid.lefts.should.eql([ 0, 20, 80, 100, 120 ]);
    grid.tops.should.eql([ 0, 24 ]);

    c.resize(60, 24);
    grid.lefts.should.eql([ 0, 10, 40, 50, 60 ]);
    grid.tops.should.eql([ 0, 24 ]);

    c.resize(40, 24);
    grid.lefts.should.eql([ 0, 10, 25, 30, 40 ]);
    grid.tops.should.eql([ 0, 24 ]);
  });

  it("adjust constraints", () => {
    const c = new Canvas(60, 24);
    const grid = new GridLayout(
      c.all(),
      [ GridLayout.stretchWithMinimum(1, 8), GridLayout.stretch(2) ],
      [ GridLayout.stretch(1), GridLayout.fixed(2) ],
    );

    grid.lefts.should.eql([ 0, 20, 60 ]);
    grid.tops.should.eql([ 0, 22, 24 ]);
    const r1 = grid.layoutAt(0, 0);
    const r2 = grid.layoutAt(1, 0);
    dimensions(r1).should.eql([ 0, 0, 20, 22 ]);
    dimensions(r2).should.eql([ 20, 0, 40, 22 ]);

    grid.adjustCol(0, GridLayout.stretchWithMinimum(1, 30));
    grid.lefts.should.eql([ 0, 30, 60 ]);
    grid.tops.should.eql([ 0, 22, 24 ]);
    dimensions(r1).should.eql([ 0, 0, 30, 22 ]);
    dimensions(r2).should.eql([ 30, 0, 30, 22 ]);
  });

  describe("grid with all fixed widths", () => {
    const c = new Canvas(60, 24);

    it("goldilocks", () => {
      const grid = new GridLayout(
        c.all(),
        [ GridLayout.stretch(1) ],
        [ 6, 15, 3 ].map(n => GridLayout.fixed(n)),
      );

      grid.tops.should.eql([ 0, 6, 21, 24 ]);
    });

    it("too small", () => {
      const grid = new GridLayout(
        c.all(),
        [ GridLayout.stretch(1) ],
        [ 10, 15, 3 ].map(n => GridLayout.fixed(n)),
      );

      // remainders should be zero-height
      grid.tops.should.eql([ 0, 10, 24, 24 ]);
    });

    it("too big", () => {
      const grid = new GridLayout(
        c.all(),
        [ GridLayout.stretch(1) ],
        [ 5, 10, 3 ].map(n => GridLayout.fixed(n)),
      );

      // empty space at the end
      grid.tops.should.eql([ 0, 5, 15, 18 ]);
    });
  });
});
