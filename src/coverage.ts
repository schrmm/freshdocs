import picomatch from "picomatch";
import type { DocIndex } from "./docmeta-index.ts";

export interface CoverageReport {
  covered: number;
  total: number;
  percent: number;
  undocumented: string[];
}

/** Fraction of code files matched by at least one doc's `covers` glob. */
export function coverageOf(codeFiles: string[], index: DocIndex): CoverageReport {
  if (codeFiles.length === 0) {
    return { covered: 0, total: 0, percent: 100, undocumented: [] };
  }

  const matchers = index.entries
    .filter((e) => e.meta.covers.length > 0)
    .map((e) => picomatch(e.meta.covers));

  const undocumented: string[] = [];
  let covered = 0;
  for (const file of codeFiles) {
    if (matchers.some((m) => m(file))) covered += 1;
    else undocumented.push(file);
  }

  const percent = Math.round((covered / codeFiles.length) * 1000) / 10;
  return { covered, total: codeFiles.length, percent, undocumented };
}
