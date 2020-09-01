import { Region } from "./canvas";

export interface Constraint {
  minimum: number;
  factor: number;
}

export class GridLayout {
  lefts: number[] = [];
  tops: number[] = [];
  resizeListeners: Set<() => void> = new Set();

  constructor(public region: Region, public colConstraints: Constraint[], public rowConstraints: Constraint[]) {
    this.resize(region.cols, region.rows);
    region.onResize(() => {
      this.resize(region.cols, region.rows);
    });
  }

  static fixed(cells: number): Constraint {
    return { minimum: cells, factor: 0 };
  }

  static stretch(factor: number): Constraint {
    return { minimum: 0, factor };
  }

  static stretchWithMinimum(factor: number, minimum: number): Constraint {
    return { minimum, factor };
  }

  update(colConstraints: Constraint[], rowConstraints: Constraint[]) {
    this.colConstraints = colConstraints;
    this.rowConstraints = rowConstraints;
    this.resize(this.region.cols, this.region.rows);
  }

  adjustCol(x: number, c: Constraint) {
    this.colConstraints[x] = c;
    this.update(this.colConstraints, this.rowConstraints);
  }

  adjustRow(y: number, c: Constraint) {
    this.rowConstraints[y] = c;
    this.update(this.colConstraints, this.rowConstraints);
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

    for (const f of [...this.resizeListeners]) f();
  }
}


function sum(list: number[]): number {
  return list.reduce((sum, n) => sum + n, 0);
}

interface ConstraintCalculation {
  constraint: Constraint;
  size?: number;
  possibleSize: number;
}

function calculateSizes(constraints: Constraint[], size: number): number[] {
  // divide up the space by weight, but if any element doesn't make its
  // minimum, give it a fixed size and don't count it among the weights.
  const results: ConstraintCalculation[] = constraints.map(constraint => ({ constraint, possibleSize: 0 }));
  let remaining = size;

  let solved = false;
  while (!solved) {
    solved = true;

    // only unplaced elements contribute to weight
    const weight = sum(results.filter(r => r.size === undefined).map(r => r.constraint.factor));
    for (const r of results) {
      if (r.size !== undefined) continue;
      r.possibleSize = Math.floor(remaining * r.constraint.factor / weight);
      if (r.possibleSize < r.constraint.minimum) {
        // weighted distribution didn't give this element its minimum size.
        // pin it to the minimum size, remove it from the available space,
        // remove it from the pool of weighted elements, and do another round.
        r.size = Math.min(r.constraint.minimum, remaining);
        remaining -= r.size;
        solved = false;
      }
    }
  }

  // the truncation above may result in unused space. allocate it round-robin
  // to the stretch constraints until it's used up.
  let total = sum(results.map(r => r.size ?? r.possibleSize));
  for (let i = 0; total < size; i++) {
    if (results[i].constraint.factor > 0 && results[i].size === undefined) {
      results[i].possibleSize++;
      total++;
    }
  }

  return results.map(r => r.size ?? r.possibleSize);
}
