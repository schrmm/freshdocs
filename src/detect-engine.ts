import picomatch from "picomatch";
import type { DocIndex } from "./docmeta-index.ts";
import { isExplicitCover } from "./coverage.ts";
import { DEFAULT_CODE_PREFIXES } from "./repo-policy.ts";

export type Severity = "fail" | "warn";

export interface Finding {
  /** For drift/broken-link/macro-stale this is a doc path. For uncovered it is the file lacking docs. */
  doc: string;
  kind: "drift" | "broken-link" | "macro-stale" | "uncovered";
  severity: Severity;
  reason: string;
}

export interface DetectInput {
  /** Repo-relative paths changed in this commit / PR range. */
  changedFiles: string[];
  index: DocIndex;
}

/**
 * Pure drift detection. A gated doc is flagged when one of its `covers` globs
 * matches a changed file and the doc itself was not edited in the same change
 * set. Severity follows audience: agent docs fail the gate, human docs warn.
 */
export function detect({ changedFiles, index }: DetectInput): Finding[] {
  const changed = new Set(changedFiles);
  const findings: Finding[] = [];

  for (const entry of index.entries) {
    if (entry.meta.covers.length === 0) continue;
    if (changed.has(entry.path)) continue; // doc updated alongside the code

    const isMatch = picomatch(entry.meta.covers);
    const hit = changedFiles.find((file) => isMatch(file));
    if (!hit) continue;

    findings.push({
      doc: entry.path,
      kind: "drift",
      severity: entry.meta.audience === "agent" ? "fail" : "warn",
      reason: `covered file changed without doc update: ${hit}`,
    });
  }

  return findings;
}

export interface UncoveredInput {
  /** Files newly created (git status A) in this commit / staged set. */
  newlyAddedFiles: string[];
  index: DocIndex;
  /** Override the default code-surface prefixes. */
  codePrefixes?: readonly string[];
}

/**
 * Per-commit existence detector. Fires WARN for every newly-added source file
 * that no doc lists explicitly. Wildcards do not satisfy this check —
 * `src/**` keeps drift wired, but doesn't pre-satisfy existence for new files.
 */
export function detectUncovered({
  newlyAddedFiles,
  index,
  codePrefixes = DEFAULT_CODE_PREFIXES,
}: UncoveredInput): Finding[] {
  const explicitSet = new Set<string>();
  for (const entry of index.entries) {
    for (const cover of entry.meta.covers) {
      if (isExplicitCover(cover)) explicitSet.add(cover);
    }
  }

  const findings: Finding[] = [];
  for (const file of newlyAddedFiles) {
    if (file.endsWith(".md")) continue;
    if (!codePrefixes.some((p) => file.startsWith(p))) continue;
    if (explicitSet.has(file)) continue;
    findings.push({
      doc: file,
      kind: "uncovered",
      severity: "warn",
      reason: "new source file with no explicit doc coverage",
    });
  }
  return findings;
}
