---
audience: agent
covers: ["src/audience.ts", "src/docmeta-index.ts", "src/init-docmeta.ts", "src/write-frontmatter.ts", "src/repo-files.ts", "src/repo-policy.ts"]
synced: b99a2f4d417555178bb8c1f0652d052e4dcc46dc
reviewed: 2026-05-26
review_interval: 30d
---

# Repo walking & docmeta

The layer that walks the repo (docs on one side, code on the other) and round-trips `docmeta:` frontmatter. Six small modules, one shared repo policy, one `Audience` type.

## Audience (`src/audience.ts`)

```ts
type Audience = "agent" | "human";
const AGENT_CONTEXT_FILES = new Set(["CLAUDE.md", "AGENTS.md", "CONTEXT.md"]);
function inferAudience(relPath: string): Audience;
```

- `inferAudience` is the fallback used when frontmatter omits `audience:`.
- Rules: basename in `AGENT_CONTEXT_FILES` → `agent`; path under `docs/agents/` → `agent`; everything else → `human`.
- Normalises `\\` → `/` before matching.

## Docmeta index (`src/docmeta-index.ts`)

The doc-side walker. Reads every markdown file in the repo, parses its frontmatter, and returns a partitioned index.

```ts
interface DocEntry { path: string; meta: Docmeta }
interface DocIndex { entries: DocEntry[]; ungated: UngatedDoc[] }

function parseDocmeta(content: string, relPath: string): ParseResult;
function buildIndex(repoRoot: string): DocIndex;
```

`Docmeta` fields: `audience`, `covers: string[]`, optional `synced`, `reviewed`, `reviewInterval` (the YAML key is `review_interval`).

Parse rules:
- Frontmatter regex: `^---\r?\n([\s\S]*?)\r?\n---` — leading block only, CRLF-tolerant.
- YAML parsed with `schema: "failsafe"` so date scalars (`2026-05-22`) stay strings.
- Missing/malformed frontmatter → `{ gated: false, reason: "no docmeta" | "malformed frontmatter" }`.
- `audience` not `"agent"`/`"human"` → falls back to `inferAudience(relPath)`.
- `covers` non-array → `[]`.

`buildIndex` walks the repo recursively, skipping the shared `IGNORED_DIRS = {"node_modules", "dist", ".git", ".agents"}` from `repo-policy.ts`. Only `.md` files are read. Paths are returned as repo-relative POSIX (`/`-joined, regardless of host separator).

Partition: parsed docs → `entries`; un-parseable → `ungated` (drives the bootstrap nudge in `reporter.ts`).

## Init docmeta (`src/init-docmeta.ts`)

Bootstrap step: propose conservative blank frontmatter for every doc the index flags as `ungated`.

```ts
function initDocmeta(repoRoot: string, opts?: { dryRun?: boolean }): InitResult;
interface InitResult { proposals: InitProposal[]; written: string[] }
```

- Builds an index, then maps `ungated` → `{ path, init: { audience: inferAudience(path), covers: [] } }`.
- `dryRun: true` → return proposals only, no writes.
- Default → for each proposal, read the file, run `writeFrontmatter`, write back if the content changed. `written` reports paths actually modified.
- `covers` is deliberately left empty: filling it is the LLM's job after `freshdocs-audit --init`.

Invoked by the audit CLI's `--init` (and `--init --apply`) flags.

## Write frontmatter (`src/write-frontmatter.ts`)

Pure transform: prepend a fresh `docmeta` block to a doc that has none.

```ts
interface FrontmatterInit { audience: Audience; covers: string[]; synced?: string; reviewed?: string; reviewInterval?: string }
function writeFrontmatter(content: string, init: FrontmatterInit): string;
```

- If the content already starts with `---\n`, returns it unchanged. Repair of *existing* frontmatter is `bumpFrontmatter`'s job — this writer never edits in place.
- Emits `covers` as a stable inline array: `["a", "b"]`. Quotes are JSON-escaped (`"` → `\"`).
- Optional fields are omitted when undefined; `reviewInterval` is written as `review_interval:` (snake_case in YAML, camelCase in TS).
- Output is `---\n<lines>\n---\n\n<original>`.

## Repo policy (`src/repo-policy.ts`)

Central home for boring repo-shape defaults used by multiple walkers/detectors.

```ts
const IGNORED_DIRS = new Set(["node_modules", "dist", ".git", ".agents"]);
const DEFAULT_CODE_PREFIXES = ["src/", "lib/", "app/", "packages/"] as const;
```

- `IGNORED_DIRS` is shared by the markdown walker, whole-repo file walker, and macro-shape reader.
- `DEFAULT_CODE_PREFIXES` is shared by audit coverage and per-commit uncovered-file detection.
- This is not a user-facing config file. It keeps hardcoded defaults in one place; optional repo config would be a future feature.

## Repo files (`src/repo-files.ts`)

The code-side walker. Lists every file in the repo as repo-relative POSIX paths.

```ts
function listFiles(repoRoot: string): Set<string>;
```

Uses the same shared ignore policy as `docmeta-index.ts`, but keeps a separate traversal because the walkers have different goals: `docmeta-index.ts` indexes markdown docs and parses `docmeta`, while `repo-files.ts` enumerates the whole repo file surface for coverage, link checks, and macro shape.

Consumers: `coverage.ts` (the code surface), gate composition (resolving "files that exist in repo" for link checks), audit (surface enumeration).

## Gotchas

- **POSIX paths everywhere.** Every public path in this layer is `/`-separated, regardless of host OS. Pass host-separator paths in only at the very edge (`join(repoRoot, ...path.split("/"))` is the standard re-inflation pattern, see `init-docmeta.ts:38`).
- **YAML failsafe schema is load-bearing.** Without it, `reviewed: 2026-05-22` becomes a `Date`, which then doesn't round-trip back through `writeFrontmatter`'s string emitters.
- **`writeFrontmatter` is one-shot, not idempotent over edits.** Re-running it on a doc that already has frontmatter is a no-op, *not* an update.
