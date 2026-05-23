import type { Finding } from "./detect-engine.ts";

export interface FingerprintInput {
  /** Top-level directory names. */
  topLevel: string[];
  /** Declared build/task script names (e.g. package.json scripts keys). */
  scripts: string[];
  /** Declared executable/command names (e.g. package.json bin keys). */
  bin: string[];
}

export type Fingerprint = FingerprintInput;

export interface StructuralChange {
  kind:
    | "dir-added"
    | "dir-removed"
    | "script-added"
    | "script-removed"
    | "bin-added"
    | "bin-removed";
  name: string;
}

const sortUnique = (xs: string[]): string[] => [...new Set(xs)].sort();

/** Normalize a raw shape reading into a stable, comparable fingerprint. */
export function computeFingerprint(input: FingerprintInput): Fingerprint {
  return {
    topLevel: sortUnique(input.topLevel),
    scripts: sortUnique(input.scripts),
    bin: sortUnique(input.bin),
  };
}

/** Deterministic hash: equal shapes hash equal regardless of input order. */
export function fingerprintHash(fp: Fingerprint): string {
  return JSON.stringify(computeFingerprint(fp));
}

function diffCategory(
  prev: string[],
  curr: string[],
  added: StructuralChange["kind"],
  removed: StructuralChange["kind"],
): StructuralChange[] {
  const prevSet = new Set(prev);
  const currSet = new Set(curr);
  const changes: StructuralChange[] = [];
  for (const name of curr) if (!prevSet.has(name)) changes.push({ kind: added, name });
  for (const name of prev) if (!currSet.has(name)) changes.push({ kind: removed, name });
  return changes;
}

/** Pure diff of two fingerprints into per-category add/remove changes. */
export function diffFingerprints(prev: Fingerprint, curr: Fingerprint): StructuralChange[] {
  return [
    ...diffCategory(prev.topLevel, curr.topLevel, "dir-added", "dir-removed"),
    ...diffCategory(prev.scripts, curr.scripts, "script-added", "script-removed"),
    ...diffCategory(prev.bin, curr.bin, "bin-added", "bin-removed"),
  ];
}

function summarize(changes: StructuralChange[]): string {
  return changes.map((c) => `${c.kind} ${c.name}`).join(", ");
}

/**
 * Warn on orientation/macro docs when the repo's shape changed and the doc was
 * not updated in the same change set. Macro docs map to no `covers` glob, so a
 * structural change is the signal that their subject may be out of date.
 */
export function macroFindings(
  changes: StructuralChange[],
  macroDocs: string[],
  changedFiles: string[],
): Finding[] {
  if (changes.length === 0) return [];
  const changed = new Set(changedFiles);
  const reason = `repo structure changed (${summarize(changes)}); review this orientation doc`;
  return macroDocs
    .filter((doc) => !changed.has(doc))
    .map((doc) => ({ doc, kind: "macro-stale", severity: "warn", reason }));
}
