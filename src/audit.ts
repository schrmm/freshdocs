import { readFileSync } from "node:fs";
import { join } from "node:path";
import { buildIndex, type DocEntry } from "./docmeta-index.ts";
import { coverageOf, type CoverageReport } from "./coverage.ts";
import {
  checkInternalLinks,
  externalUrlsFrom,
  type DocFile,
} from "./link-checker.ts";
import { listFiles } from "./repo-files.ts";
import { DEFAULT_CODE_PREFIXES } from "./repo-policy.ts";
import { urlHealth, type Fetcher, type LinkStatus } from "./url-health.ts";
import type { Finding } from "./detect-engine.ts";

export interface OverdueDoc {
  doc: string;
  reviewed: string;
  reviewInterval: string;
  deadline: string;
}

export interface AuditReport {
  coverage: CoverageReport;
  overdue: OverdueDoc[];
  brokenLinks: Finding[];
  externalLinks: LinkStatus[];
  /** Files in the code surface that no doc lists explicitly. Mirrors coverage.uncoveredFiles. */
  uncovered: string[];
}

export interface AuditOptions {
  /** Files counted as the code surface for coverage. Default: all repo files outside docs/ and not .md. */
  codeFiles?: string[];
  /** Clock for time-based staleness checks. Default: `new Date()`. */
  now?: Date;
  /** External-URL fetcher (kept injectable so tests never hit the network). */
  fetch?: Fetcher;
}

function parseDays(interval: string): number | null {
  const m = interval.match(/^(\d+)d$/i);
  return m ? Number(m[1]) : null;
}

function deadlineFor(entry: DocEntry): { deadline: Date; reviewed: string; reviewInterval: string } | null {
  const { reviewed, reviewInterval } = entry.meta;
  if (!reviewed || !reviewInterval) return null;
  const days = parseDays(reviewInterval);
  if (days === null) return null;
  const reviewedDate = new Date(reviewed);
  if (Number.isNaN(reviewedDate.getTime())) return null;
  const deadline = new Date(reviewedDate.getTime() + days * 86_400_000);
  return { deadline, reviewed, reviewInterval };
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function defaultCodeFiles(existing: Set<string>): string[] {
  const out: string[] = [];
  for (const path of existing) {
    if (path.endsWith(".md")) continue;
    if (!DEFAULT_CODE_PREFIXES.some((p) => path.startsWith(p))) continue;
    out.push(path);
  }
  return out;
}

/**
 * Read-only documentation health snapshot for the whole repo.
 * - coverage: which code files lack a covering doc
 * - overdue: docs past their review interval
 * - brokenLinks: broken internal links across every doc
 * - externalLinks: HTTP health of every external URL, via the injected fetcher
 */
export async function runAudit(repoRoot: string, opts: AuditOptions = {}): Promise<AuditReport> {
  const now = opts.now ?? new Date();
  const fetch: Fetcher = opts.fetch ?? (async () => null);

  const index = buildIndex(repoRoot);
  const existing = listFiles(repoRoot);
  const codeFiles = opts.codeFiles ?? defaultCodeFiles(existing);

  const allDocs: DocFile[] = [...existing]
    .filter((p) => p.endsWith(".md"))
    .map((p) => ({ path: p, content: readFileSync(join(repoRoot, ...p.split("/")), "utf8") }));

  const overdue: OverdueDoc[] = index.entries.flatMap((entry) => {
    const info = deadlineFor(entry);
    if (!info) return [];
    if (now.getTime() <= info.deadline.getTime()) return [];
    return [{
      doc: entry.path,
      reviewed: info.reviewed,
      reviewInterval: info.reviewInterval,
      deadline: isoDate(info.deadline),
    }];
  });

  const brokenLinks = checkInternalLinks(allDocs, existing);
  const externalLinks = await urlHealth(externalUrlsFrom(allDocs), { fetch });
  const coverage = coverageOf(codeFiles, index);

  return { coverage, overdue, brokenLinks, externalLinks, uncovered: coverage.uncoveredFiles };
}
