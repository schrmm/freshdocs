import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { inferAudience } from "./audience.ts";
import { buildIndex } from "./docmeta-index.ts";
import { writeFrontmatter, type FrontmatterInit } from "./write-frontmatter.ts";

export interface InitProposal {
  path: string;
  init: FrontmatterInit;
}

export interface InitResult {
  proposals: InitProposal[];
  written: string[];
}

export interface InitOptions {
  /** If true, return proposals without touching files. */
  dryRun?: boolean;
}

/**
 * Propose (and optionally write) `docmeta` frontmatter for every doc the index
 * marks as un-gated. The proposal is intentionally conservative: audience is
 * inferred from path, `covers` is left empty, and time fields are omitted.
 * Filling in meaningful `covers` is the LLM's job after freshdocs-audit --init.
 */
export function initDocmeta(repoRoot: string, opts: InitOptions = {}): InitResult {
  const index = buildIndex(repoRoot);
  const proposals: InitProposal[] = index.ungated.map((u) => ({
    path: u.path,
    init: { audience: inferAudience(u.path), covers: [] },
  }));

  const written: string[] = [];
  if (!opts.dryRun) {
    for (const { path, init } of proposals) {
      const full = join(repoRoot, ...path.split("/"));
      const original = readFileSync(full, "utf8");
      const updated = writeFrontmatter(original, init);
      if (updated !== original) {
        writeFileSync(full, updated);
        written.push(path);
      }
    }
  }

  return { proposals, written };
}
