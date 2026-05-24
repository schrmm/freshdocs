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
}

function nudge(count: number | undefined): string | null {
  if (!count) return null;
  return `note: ${count} un-gated doc${count === 1 ? "" : "s"} have no docmeta — run /doc-audit --init to bootstrap.`;
}

/** Render findings to gate output and decide the exit code (fail → nonzero). */
export function formatReport(findings: Finding[], opts: ReportOptions = {}): Report {
  const nudgeLine = nudge(opts.ungatedCount);

  if (findings.length === 0) {
    const headline = "freshdocs: docs up to date — no issues detected.";
    return {
      exitCode: 0,
      output: nudgeLine ? `${headline}\n${nudgeLine}` : headline,
    };
  }

  const lines = findings.map(
    (f) => `${MARKER[f.severity]}  ${f.doc} — ${f.reason}`,
  );
  const hasFailure = findings.some((f) => f.severity === "fail");
  const out = ["freshdocs: documentation issues detected", ...lines];
  if (nudgeLine) out.push(nudgeLine);

  return { exitCode: hasFailure ? 1 : 0, output: out.join("\n") };
}
