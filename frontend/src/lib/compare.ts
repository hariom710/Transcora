export type DiffKind = "same" | "added" | "removed";

export interface DiffLine {
  kind: DiffKind;
  text: string;
}

/** Above this many LCS cells the middles are reported as a whole-block
    change instead of computed — bounds memory/time on huge documents.
    shortcut: pathological mid-sections lose line alignment; raise for slower
    but finer diffs if anyone hits it. */
const LCS_CELL_LIMIT = 4_000_000;

function lcsDiff(a: readonly string[], b: readonly string[]): DiffLine[] {
  const n = a.length;
  const m = b.length;
  const width = m + 1;
  const dp = new Uint32Array((n + 1) * width);
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i * width + j] =
        a[i] === b[j]
          ? dp[(i + 1) * width + j + 1] + 1
          : Math.max(dp[(i + 1) * width + j], dp[i * width + j + 1]);
    }
  }
  const out: DiffLine[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      out.push({ kind: "same", text: a[i] });
      i++;
      j++;
    } else if (dp[(i + 1) * width + j] >= dp[i * width + j + 1]) {
      out.push({ kind: "removed", text: a[i] });
      i++;
    } else {
      out.push({ kind: "added", text: b[j] });
      j++;
    }
  }
  while (i < n) out.push({ kind: "removed", text: a[i++] });
  while (j < m) out.push({ kind: "added", text: b[j++] });
  return out;
}

/** Line diff of two versions: `removed` exists only in a, `added` only in b.
    Common prefix/suffix are trimmed first, so typical edits stay cheap. */
export function diffLines(a: readonly string[], b: readonly string[]): DiffLine[] {
  let start = 0;
  while (start < a.length && start < b.length && a[start] === b[start]) start++;

  let endA = a.length;
  let endB = b.length;
  while (endA > start && endB > start && a[endA - 1] === b[endB - 1]) {
    endA--;
    endB--;
  }

  const prefix = a.slice(0, start).map((text) => ({ kind: "same" as const, text }));
  const suffix = a.slice(endA).map((text) => ({ kind: "same" as const, text }));
  const midA = a.slice(start, endA);
  const midB = b.slice(start, endB);

  if (midA.length * midB.length > LCS_CELL_LIMIT) {
    return [
      ...prefix,
      ...midA.map((text) => ({ kind: "removed" as const, text })),
      ...midB.map((text) => ({ kind: "added" as const, text })),
      ...suffix,
    ];
  }
  return [...prefix, ...lcsDiff(midA, midB), ...suffix];
}

export interface DiffStats {
  same: number;
  removed: number;
  added: number;
}

export function diffStats(lines: readonly DiffLine[]): DiffStats {
  const stats: DiffStats = { same: 0, removed: 0, added: 0 };
  for (const line of lines) stats[line.kind]++;
  return stats;
}
