import type { Finding } from "./detect-engine.ts";

export interface Report {
  exitCode: number;
  output: string;
}

const MARKER: Record<Finding["severity"], string> = {
  fail: "✗ FAIL",
  warn: "⚠ WARN",
};

/** Render findings to gate output and decide the exit code (fail → nonzero). */
export function formatReport(findings: Finding[]): Report {
  if (findings.length === 0) {
    return { exitCode: 0, output: "freshdocs: docs up to date — no issues detected." };
  }

  const lines = findings.map(
    (f) => `${MARKER[f.severity]}  ${f.doc} — ${f.reason}`,
  );
  const hasFailure = findings.some((f) => f.severity === "fail");

  return {
    exitCode: hasFailure ? 1 : 0,
    output: ["freshdocs: documentation issues detected", ...lines].join("\n"),
  };
}
