import type { Finding } from "./detect-engine.ts";

export interface Report {
  exitCode: number;
  output: string;
}

const MARKER: Record<Finding["severity"], string> = {
  fail: "✗ FAIL",
  warn: "⚠ WARN",
};

export interface ReportOptions {
  /** Count of repo docs that have no docmeta frontmatter. Drives a non-blocking nudge. */
  ungatedCount?: number;
  /** True when drift findings were intentionally downgraded for a non-behavior change. */
  noBehaviorChange?: boolean;
}

function nudge(count: number | undefined): string | null {
  if (!count) return null;
  return `note: ${count} un-gated doc${count === 1 ? "" : "s"} have no docmeta — run freshdocs-audit --init to bootstrap.`;
}

function noBehaviorChangeNote(active: boolean | undefined): string | null {
  return active ? "note: non-behavior-change override active — drift findings are warnings; link failures still block." : null;
}

/** Render findings to gate output and decide the exit code (fail → nonzero). */
export function formatReport(findings: Finding[], opts: ReportOptions = {}): Report {
  const nudgeLine = nudge(opts.ungatedCount);
  const overrideLine = noBehaviorChangeNote(opts.noBehaviorChange);
  const notes = [overrideLine, nudgeLine].filter((line): line is string => line !== null);

  if (findings.length === 0) {
    const headline = "freshdocs: docs up to date — no issues detected.";
    return {
      exitCode: 0,
      output: notes.length > 0 ? `${headline}\n${notes.join("\n")}` : headline,
    };
  }

  const lines = findings.map(
    (f) => `${MARKER[f.severity]}  ${f.doc} — ${f.reason}`,
  );
  const hasFailure = findings.some((f) => f.severity === "fail");
  const out = ["freshdocs: documentation issues detected", ...lines];
  out.push(...notes);

  return { exitCode: hasFailure ? 1 : 0, output: out.join("\n") };
}
