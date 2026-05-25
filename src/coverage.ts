import picomatch from "picomatch";
import type { DocIndex } from "./docmeta-index.ts";

export interface CoverageReport {
  total: number;
  explicit: number;
  wildcardOnly: number;
  uncovered: number;
  percent: number; // explicit / total — the honest metric
  explicitFiles: string[];
  wildcardOnlyFiles: string[];
  uncoveredFiles: string[];
}

/** A `covers:` entry satisfies the existence axis only when it has no wildcards. */
export function isExplicitCover(cover: string): boolean {
  return !cover.includes("*");
}

/**
 * Split coverage of a code surface by whether each file is reached by an
 * explicit `covers:` entry, only by a wildcard, or not at all.
 *
 * `percent` is intentionally `explicit / total` — wildcards still flag drift
 * but no longer satisfy the existence question.
 */
export function coverageOf(codeFiles: string[], index: DocIndex): CoverageReport {
  if (codeFiles.length === 0) {
    return {
      total: 0,
      explicit: 0,
      wildcardOnly: 0,
      uncovered: 0,
      percent: 100,
      explicitFiles: [],
      wildcardOnlyFiles: [],
      uncoveredFiles: [],
    };
  }

  // Build explicit-set (literal paths only) and wildcard matchers separately.
  const explicitSet = new Set<string>();
  const wildcardGlobs: string[] = [];
  for (const entry of index.entries) {
    for (const cover of entry.meta.covers) {
      if (isExplicitCover(cover)) explicitSet.add(cover);
      else wildcardGlobs.push(cover);
    }
  }
  const wildcardMatch = wildcardGlobs.length > 0 ? picomatch(wildcardGlobs) : () => false;

  const explicitFiles: string[] = [];
  const wildcardOnlyFiles: string[] = [];
  const uncoveredFiles: string[] = [];
  for (const file of codeFiles) {
    if (explicitSet.has(file)) explicitFiles.push(file);
    else if (wildcardMatch(file)) wildcardOnlyFiles.push(file);
    else uncoveredFiles.push(file);
  }

  const percent = Math.round((explicitFiles.length / codeFiles.length) * 1000) / 10;
  return {
    total: codeFiles.length,
    explicit: explicitFiles.length,
    wildcardOnly: wildcardOnlyFiles.length,
    uncovered: uncoveredFiles.length,
    percent,
    explicitFiles,
    wildcardOnlyFiles,
    uncoveredFiles,
  };
}
