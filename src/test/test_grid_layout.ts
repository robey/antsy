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
});
