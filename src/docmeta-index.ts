import { parse as parseYaml } from "yaml";
import { readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { inferAudience, type Audience } from "./audience.ts";

export type { Audience } from "./audience.ts";

export interface Docmeta {
  audience: Audience;
  covers: string[];
  synced?: string;
  reviewed?: string;
  reviewInterval?: string;
}

export interface DocEntry {
  path: string;
  meta: Docmeta;
}

export type ParseResult =
  | { gated: true; entry: DocEntry }
  | { gated: false; reason: string };

export interface UngatedDoc {
  path: string;
  reason: string;
}

export interface DocIndex {
  entries: DocEntry[];
  ungated: UngatedDoc[];
}

const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---/;

function asString(value: unknown): string | undefined {
  return value == null ? undefined : String(value);
}

export function parseDocmeta(content: string, relPath: string): ParseResult {
  const match = content.match(FRONTMATTER);
  if (!match) return { gated: false, reason: "no docmeta" };

  let raw: unknown;
  try {
    // failsafe schema keeps every scalar a string (e.g. dates like 2026-05-22)
    raw = parseYaml(match[1]!, { schema: "failsafe" });
  } catch {
    return { gated: false, reason: "malformed frontmatter" };
  }
  if (raw == null || typeof raw !== "object") {
    return { gated: false, reason: "malformed frontmatter" };
  }

  const fields = raw as Record<string, unknown>;
  const audience: Audience = fields.audience === "agent" || fields.audience === "human"
    ? (fields.audience as Audience)
    : inferAudience(relPath);
  const covers = Array.isArray(fields.covers) ? fields.covers.map(String) : [];

  return {
    gated: true,
    entry: {
      path: relPath,
      meta: {
        audience,
        covers,
        synced: asString(fields.synced),
        reviewed: asString(fields.reviewed),
        reviewInterval: asString(fields.review_interval),
      },
    },
  };
}

const IGNORED_DIRS = new Set(["node_modules", "dist", ".git"]);

function* walkMarkdown(root: string, dir: string): Generator<string> {
  for (const dirent of readdirSync(dir, { withFileTypes: true })) {
    if (dirent.isDirectory()) {
      if (IGNORED_DIRS.has(dirent.name)) continue;
      yield* walkMarkdown(root, join(dir, dirent.name));
    } else if (dirent.isFile() && dirent.name.endsWith(".md")) {
      yield join(dir, dirent.name);
    }
  }
}

/** Walk a repo, indexing every markdown doc by its docmeta frontmatter. */
export function buildIndex(repoRoot: string): DocIndex {
  const entries: DocEntry[] = [];
  const ungated: UngatedDoc[] = [];

  for (const fullPath of walkMarkdown(repoRoot, repoRoot)) {
    const relPath = relative(repoRoot, fullPath).split(sep).join("/");
    const result = parseDocmeta(readFileSync(fullPath, "utf8"), relPath);
    if (result.gated) entries.push(result.entry);
    else ungated.push({ path: relPath, reason: result.reason });
  }

  return { entries, ungated };
}
