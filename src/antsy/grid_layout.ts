import { Region } from "./canvas";

interface FixedConstraint {
  kind: "fixed";
  cells: number;
}

interface StretchConstraint {
  kind: "stretch";
  factor: number;
}

export type Constraint = FixedConstraint | StretchConstraint;

export class GridLayout {
  lefts: number[];
  tops: number[];
  resizeListeners: Set<() => void> = new Set();

  constructor(public region: Region, public colConstraints: Constraint[], public rowConstraints: Constraint[]) {
    // all elements are 0 sized until we resize.
    this.lefts = colConstraints.map(_ => 0);
    this.tops = rowConstraints.map(_ => 0);
    this.resize(region.cols, region.rows);
    region.onResize(() => {
      this.resize(region.cols, region.rows);
      for (const f of [...this.resizeListeners]) f();
    });
  }

  static fixed(cells: number): FixedConstraint {
    return { kind: "fixed", cells };
  }

  static stretch(factor: number): StretchConstraint {
    return { kind: "stretch", factor };
  }

  layout(x1: number, y1: number, x2: number, y2: number): Region {
    const r = this.region.clip(this.lefts[x1], this.tops[y1], this.lefts[x2], this.tops[y2]);
    this.resizeListeners.add(() => {
      r.resize(this.lefts[x1], this.tops[y1], this.lefts[x2], this.tops[y2]);
    });
    return r;
  }

  layoutAt(x1: number, y1: number): Region {
    return this.layout(x1, y1, x1 + 1, y1 + 1);
  }

  resize(cols: number, rows: number) {
    const widths = calculateSizes(this.colConstraints, cols);
    const heights = calculateSizes(this.rowConstraints, rows);
    let left = 0, top = 0;
    this.lefts = widths.map(w => {
      left += w;
      return left - w;
    });
    this.lefts.push(left);
    this.tops = heights.map(h => {
      top += h;
      return top - h;
    });
    this.tops.push(top);
  }
}


function sum(list: number[]): number {
  return list.reduce((sum, n) => sum + n, 0);
}

function calculateSizes(constraints: Constraint[], size: number): number[] {
  const fixed = sum(constraints.map(c => c.kind == "fixed" ? c.cells : 0));
  const weight = sum(constraints.map(c => c.kind == "stretch" ? c.factor : 0));
  let fixedRemain = Math.min(size, fixed);
  const stretch = size - fixedRemain;
  let stretchRemain = stretch;

  const sizes = constraints.map(c => {
    let n = 0;
    switch (c.kind) {
      case "fixed":
        n = Math.min(fixedRemain, c.cells);
        fixedRemain -= n;
        break;
      case "stretch":
        n = Math.floor(stretch * c.factor / weight);
        stretchRemain -= n;
        break;
    }
    return n;
  });

  // the truncation above may result in unused space. allocate it round-robin
  // to the stretch constraints until it's used up.
  for (let i = 0; stretchRemain > 0; i++) {
    if (constraints[i].kind == "stretch") {
      sizes[i]++;
      stretchRemain--;
    }
  }

  return sizes;
}
