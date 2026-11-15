// Where an envelope's A, D, S and R values sit inside its graph: each under the middle of its own stage, pushed
// apart where stages are short so the tags never overlap, and kept inside the graph.

export interface TagRow {
  centres: readonly number[]; // each stage's middle, left to right
  width: number; // a tag's width
  gap: number; // the least space between tags
  left: number; // the graph's inner edges
  right: number;
}

// Each tag's left edge.
export function spreadTags(row: TagRow): number[] {
  const step = row.width + row.gap;
  const xs: number[] = [];
  for (const c of row.centres) {
    const prev = xs.length ? xs[xs.length - 1]! + step : row.left;
    xs.push(Math.max(prev, c - row.width / 2));
  }
  // Past the right edge: pull back from the right, keeping the spacing.
  let limit = row.right - row.width;
  for (let i = xs.length - 1; i >= 0; i--) {
    xs[i] = Math.min(xs[i]!, limit);
    limit = xs[i]! - step;
  }
  return xs;
}
