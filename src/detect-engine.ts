import picomatch from "picomatch";
import type { DocIndex } from "./docmeta-index.ts";

export type Severity = "fail" | "warn";

export interface Finding {
  doc: string;
  kind: "drift" | "broken-link" | "macro-stale";
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
