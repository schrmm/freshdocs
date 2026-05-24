import type { Audience } from "./docmeta-index.ts";

export interface FrontmatterInit {
  audience: Audience;
  covers: string[];
  synced?: string;
  reviewed?: string;
  reviewInterval?: string;
}

const HAS_FRONTMATTER = /^---\r?\n/;

function emitCovers(covers: string[]): string {
  // Stable, predictable inline-array form that round-trips through yaml.failsafe.
  const items = covers.map((c) => `"${c.replace(/"/g, '\\"')}"`);
  return `[${items.join(", ")}]`;
}

/**
 * Prepend a fresh `docmeta` frontmatter block to a doc that has none.
 * No-op when the doc already has frontmatter — repair of existing frontmatter
 * is `bumpFrontmatter`'s job.
 */
export function writeFrontmatter(content: string, init: FrontmatterInit): string {
  if (HAS_FRONTMATTER.test(content)) return content;

  const lines = ["---", `audience: ${init.audience}`, `covers: ${emitCovers(init.covers)}`];
  if (init.synced !== undefined) lines.push(`synced: ${init.synced}`);
  if (init.reviewed !== undefined) lines.push(`reviewed: ${init.reviewed}`);
  if (init.reviewInterval !== undefined) lines.push(`review_interval: ${init.reviewInterval}`);
  lines.push("---", "");
  return `${lines.join("\n")}\n${content}`;
}
