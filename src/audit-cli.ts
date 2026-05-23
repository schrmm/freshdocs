#!/usr/bin/env node
import { pathToFileURL } from "node:url";
import { runAudit, type AuditReport } from "./audit.ts";
import type { Fetcher } from "./url-health.ts";

const HEAD_TIMEOUT_MS = 5_000;

async function tryFetch(url: string, method: "HEAD" | "GET"): Promise<{ status: number } | null> {
  try {
    const res = await fetch(url, {
      method,
      redirect: "follow",
      signal: AbortSignal.timeout(HEAD_TIMEOUT_MS),
    });
    if (method === "GET") {
      // We only want the status; drain quietly so the socket can close.
      await res.body?.cancel().catch(() => undefined);
    }
    return { status: res.status };
  } catch {
    return null;
  }
}

const realFetcher: Fetcher = async (url) => {
  // Many sites (GitHub blob pages, sites with strict security) reject HEAD;
  // fall back to GET so we don't report false-broken externals.
  const head = await tryFetch(url, "HEAD");
  if (head && head.status >= 200 && head.status < 400) return head;
  const get = await tryFetch(url, "GET");
  return get ?? head;
};

function render(report: AuditReport): string {
  const lines: string[] = ["freshdocs audit"];

  lines.push("");
  lines.push(`Coverage: ${report.coverage.covered}/${report.coverage.total} (${report.coverage.percent}%)`);
  if (report.coverage.undocumented.length > 0) {
    lines.push(`  undocumented (${report.coverage.undocumented.length}):`);
    for (const p of report.coverage.undocumented.slice(0, 20)) lines.push(`    - ${p}`);
    if (report.coverage.undocumented.length > 20) {
      lines.push(`    ... and ${report.coverage.undocumented.length - 20} more`);
    }
  }

  lines.push("");
  if (report.overdue.length === 0) {
    lines.push("Overdue reviews: none");
  } else {
    lines.push(`Overdue reviews (${report.overdue.length}):`);
    for (const o of report.overdue) {
      lines.push(`  - ${o.doc}  (reviewed ${o.reviewed}, +${o.reviewInterval}, deadline ${o.deadline})`);
    }
  }

  lines.push("");
  if (report.brokenLinks.length === 0) {
    lines.push("Broken internal links: none");
  } else {
    lines.push(`Broken internal links (${report.brokenLinks.length}):`);
    for (const f of report.brokenLinks) lines.push(`  - ${f.doc} — ${f.reason}`);
  }

  lines.push("");
  const broken = report.externalLinks.filter((l) => !l.ok);
  if (report.externalLinks.length === 0) {
    lines.push("External links: none referenced");
  } else if (broken.length === 0) {
    lines.push(`External links: ${report.externalLinks.length} checked, all healthy`);
  } else {
    lines.push(`External links: ${broken.length} broken of ${report.externalLinks.length}`);
    for (const l of broken) lines.push(`  - ${l.url}  (${l.reason ?? "broken"})`);
  }

  return lines.join("\n");
}

async function main(): Promise<void> {
  const report = await runAudit(process.cwd(), { fetch: realFetcher });
  process.stdout.write(`${render(report)}\n`);
  // Audit is read-only and advisory — never sets a nonzero exit code.
}

const invokedDirectly =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href;
if (invokedDirectly) {
  main().catch((err) => {
    process.stderr.write(`freshdocs-audit: ${err instanceof Error ? err.message : String(err)}\n`);
    process.exit(2);
  });
}
