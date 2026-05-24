# freshdocs — `/freshdocs:create-docs` and Strict Coverage

**Date:** 2026-05-24
**Status:** Draft (awaiting review)
**Supersedes parts of:** `docs/specs/2026-05-22-freshdocs-design.md` (the v1 spec's coverage semantics; the rest stands).

## Motivation

The v1 freshdocs is a *freshness* tool: it answers "is this doc accurate?" extremely well, but barely touches "does this doc exist?" or "is the right code documented at all?" Dogfooding `/freshdocs:doc-audit` on the freshdocs repo itself surfaced the gap:

- Bootstrap added `covers: ["src/**"]` to README.
- Audit reported **16/16 (100%) coverage**.
- Actual reality: README's *Architecture* section names ~6 of 18 modules; the other 12 have no real prose anywhere.

The metric was satisfied by a wildcard; existence was not satisfied at all. `/freshdocs:update-docs` then correctly reports "nothing to do" because nothing has drifted — but a repo with no real docs is a repo where nothing *can* drift.

**The stated goal**, restated by the user: "I want a skill which enables me to have good documentation in every repo." Existence is part of "good." The v1 tool ignores it.

## Goals

1. Make the existence gap visible — the audit reports honestly even when wildcards inflate coverage.
2. Add a first-class authoring entry point (`/freshdocs:create-docs`) that walks the gap and helps the user / agent fill it.
3. Keep the three commands aligned: `/doc-audit` inspects, `/create-docs` authors, `/update-docs` repairs. Same skill, same docmeta, same shared audit.
4. Preserve the existing boundary with `grill-with-docs` (it still owns CONTEXT.md, ADRs, domain-language extraction).

## Non-goals (v1)

- "Shallow" / "thinness" detection (doc covers N files, mentions fewer than N/3 by name). Defer until dogfooding shows it's needed.
- Auto-detecting workflow candidates from README / code mentions. Workflow doc creation is targeted-mode only in v1.
- Drafting CONTEXT.md / ADRs from `/freshdocs:create-docs`. Hand off to `grill-with-docs`.
- Re-clustering or consolidating existing docs (a separate, harder concern).
- Authoring PRDs (still `to-prd`).

## Design

### 1. Shape: one skill, three commands

`freshdocs` is the only skill. `SKILL.md` is the shared judgment layer. Three slash commands attach to it:

| Command | Role | Status |
|---|---|---|
| `/freshdocs:doc-audit` | Read-only inspect: coverage (now split), overdue, broken-link, macro-stale, external-link, **`uncovered`**. | Exists; extended |
| `/freshdocs:update-docs` | Repair drifted / broken / macro-stale / overdue / external. | Exists; scope unchanged |
| `/freshdocs:create-docs` | Author missing per-module / workflow / orientation docs. Sweep + targeted modes. | **New** |

Boundaries with neighbouring skills (unchanged from the v1 spec):

- **`grill-with-docs`** still owns CONTEXT.md authoring, ADRs, and domain-language extraction. `/freshdocs:create-docs` explicitly hands off when it sees domain-language territory.
- **`to-prd`** still owns PRDs.

### 2. Strict coverage

A `covers:` entry is now categorized:

- **Explicit** — contains no `*` (literal path: `src/audience.ts`, brace expansion like `src/{audit-cli,audit}.ts`).
- **Wildcard** — contains `*` or `**` (`src/**`, `src/*.ts`, `src/internals/*.ts`).

A source file's coverage status:

- **Explicitly covered** — at least one doc lists it as a literal path.
- **Wildcard-only** — matched only by wildcards.
- **Uncovered** — not matched at all.

The audit reports the three numbers separately:

```
Coverage:
  Explicitly documented: 3/18 (17%)
  Wildcard-only:         15/18 (83%)
  Uncovered:             0/18 (0%)
```

**Wildcards still function for drift detection** — a wildcard match still flags the doc when a matched file changes. They simply no longer *satisfy* the existence question.

Migration impact on this repo: README's `covers: ["src/**"]` keeps working for drift, but the audit no longer reports 100% coverage. We'll see honest existence numbers for the first time.

### 3. New finding type: `uncovered`

Added to the `Finding.kind` union: `drift | broken-link | macro-stale | uncovered`.

- **In the audit (state):** every wildcard-only and uncovered file shows in the audit report. Informational only.
- **In the gate (per-commit):** fires only on *git-status-A* files (newly created in the staged change set, not modifications) under the code-surface prefixes (default `["src/", "lib/", "app/", "packages/"]`; overridable). **Severity: WARN** — nudges, doesn't block. Agent-facing drift still fails the gate as before.

Drift fires on modifications to covered files; uncovered fires on additions of un-covered files. Symmetric.

This keeps day-to-day friction low while making the existence gap permanently visible in the periodic audit.

### 4. `/freshdocs:create-docs`

**Two invocation modes:**

```sh
/freshdocs:create-docs                       # sweep
/freshdocs:create-docs <path-or-pattern>     # targeted
```

**Sweep mode** (the onboarding workhorse):

1. Run the audit; take the `uncovered` + `wildcard-only` lists.
2. **Cluster semantically.** Read the uncovered source files and propose a per-module grouping — *not* one doc per file. On freshdocs's flat `src/`, the LLM might propose: `docs/agents/audit.md` (audit-cli + audit + coverage), `docs/agents/detect-engine.md`, `docs/agents/docmeta.md` (docmeta-index + init-docmeta + bump-frontmatter + write-frontmatter + audience), etc.
3. **User approves or edits the clustering** before any prose is written.
4. **Draft per group, code-first.** For each approved group, the LLM reads the source files, drafts a concise reference doc (purpose, public API, how it's invoked, gotchas) at `docs/agents/<name>.md` with full docmeta. Uncertainties are inlined as `[CLARIFY: ...]` markers, never invented prose.
5. **User reviews per file**, accepts or revises, before the next file is drafted.

**Targeted mode**: same drafting pipeline, scoped to one unit. Either:

- A source path (`/freshdocs:create-docs src/audit-cli.ts`) → writes or extends a covering doc.
- A doc path (`/freshdocs:create-docs docs/workflows/migration.md`) → scaffolds at that path.

Workflow docs (`docs/workflows/X.md`) and orientation docs (`docs/overview.md`, README sections) are **targeted-mode only** in v1 — sweep mode focuses on per-module reference because those are easiest to detect deterministically from code.

**`grill-with-docs` handoff trigger.** During drafting, if the LLM is about to invent more than ~2 domain terms it cannot infer from code (business concepts, workflow names, terminology), it stops and surfaces:

> "This doc needs domain language before I can draft confidently. Invoke `grill-with-docs` first to extract the language, then re-run `/freshdocs:create-docs`?"

The user decides. `/freshdocs:create-docs` never silently invents terminology.

**Output structure** (audience inferred from path):

| Path | audience | review_interval | docmeta shape |
|---|---|---|---|
| `docs/agents/<name>.md` | agent | 30d | full (covers + synced + reviewed) |
| `docs/workflows/<name>.md` | human | 60d | full |
| `docs/overview.md` / README sections | human (macro) | 60d | macro-style (no covers; structural fingerprint check) |

### 5. Workflow recipes

The three priority workflows, in concrete form. These go verbatim into `SKILL.md` (judgment layer) and `README.md` (humans + agents).

**A. Onboarding sweep (primary entry, fresh repo)**

```
1. npx skills add schrmm/freshdocs       # vendors skill + bins
2. freshdocs-install-commands             # one-time, global slash commands
3. freshdocs-install-hook                 # per-repo, wire pre-commit
4. freshdocs-audit --init --apply         # bootstrap empty docmeta blocks
5. /freshdocs:doc-audit                   # see the honest gap
6. /freshdocs:create-docs                 # sweep: cluster → approve → draft → review
7. /freshdocs:update-docs                 # repair any pre-existing drift
8. git add . && git commit                # gate should pass
```

**B. Steady-state commit loop (the heartbeat)**

```
1. Edit code → git add → git commit
2. Pre-commit hook runs doc-gate:
   ├─ Clean                   → commit lands
   ├─ Drift / broken-link     → BLOCKS  → /freshdocs:update-docs → re-commit
   ├─ Uncovered (new file)    → WARN    → commit lands; /freshdocs:create-docs <path> when ready
   └─ Macro-stale             → WARN    → commit lands; review when convenient
```

**C. Periodic health-check (safety net)**

```
1. /freshdocs:doc-audit
2. Read sections:
   - Explicit coverage % — gap visible
   - Overdue reviews     → /freshdocs:update-docs
   - Uncovered (state)   → /freshdocs:create-docs
   - Broken external     → /freshdocs:update-docs
   - Macro-stale         → /freshdocs:update-docs
```

**Decision table — "when to use which"**

| Situation | First command |
|---|---|
| Fresh repo / starting adoption | `/freshdocs:doc-audit` → `/freshdocs:create-docs` (sweep) |
| Commit blocked by gate | `/freshdocs:update-docs` |
| Commit warned: new uncovered file | `/freshdocs:create-docs <path>` |
| Want to document a specific module now | `/freshdocs:create-docs <path>` |
| Quarterly review / pre-release | `/freshdocs:doc-audit` → dispatch |
| Doc contradicts accepted ADR | hand off to `grill-with-docs` (superseding ADR) |
| New CONTEXT.md / domain language needed | hand off to `grill-with-docs` |

## Implementation footprint

**Code (`src/`):**

| File | Change |
|---|---|
| `coverage.ts` | Split into `explicit` / `wildcardOnly` / `uncovered` counts. Predicate: an entry is wildcard iff it contains `*`. |
| `detect-engine.ts` | Add `"uncovered"` to the `Finding.kind` union. Add a per-commit detector that fires WARN when a new src file isn't in any explicit `covers:`. |
| `audit.ts` | Extend `AuditReport` with `uncovered` (state list) and the split-coverage numbers. |
| `audit-cli.ts` | Render the new coverage shape (explicit / wildcard / uncovered). |
| `cli.ts` (gate) | Wire the new per-commit uncovered detector into the gate composition. |
| `reporter.ts` | Format the new finding kind in both gate and audit output. |

**Skill assets:**

| File | Change |
|---|---|
| `commands/create-docs.md` | **New.** Sweep + targeted modes; clustering proposal; per-file review loop; `grill-with-docs` handoff trigger. |
| `SKILL.md` | Add a "Creation loop" section alongside the existing repair loop. Embed the decision table. |
| `README.md` | Update "What it detects" to include `uncovered`. Add the decision table and the three workflow recipes (A/B/C). |

**No new bins.** `freshdocs-install-commands` already globs `commands/*.md` and will pick up `create-docs.md` automatically.

**Tests:** behavior-only.

- Coverage split rules (literal vs. wildcard predicate; brace expansion treated as literal).
- Uncovered detection (per-commit gate path + audit state path).
- Drift detection unaffected — wildcards still flag drift.
- Targeted-mode prose drafting is LLM-driven and not unit-tested; it is dogfooded against this repo as the canonical migration.

**Migration of this repo:**

After implementation, the existing bootstrap on this repo becomes a re-bootstrap. `covers: ["src/**"]` on `README.md` stops counting as explicit. `/freshdocs:doc-audit` will report meaningful explicit-coverage numbers for the first time, and `/freshdocs:create-docs` (sweep mode) will propose the per-module clustering for the 18 src files.

## Open questions

1. **Brace expansion as "explicit"?** `src/{audit-cli,audit}.ts` contains no `*` — treat as explicit (literal listing of two files). Inline-confirmed in the spec; flagged here in case the predicate proves brittle. If brace expansion is rare in practice, simplify by requiring fully-literal paths only.
2. **Clustering algorithm.** Sweep mode's clustering is LLM-judged from code reading. v1 has no deterministic clustering heuristic. If the LLM proposals are noisy, a later version might add: "files in the same top-level subdir cluster together by default."
3. **Workflow doc detection.** Deferred to v2. v1 supports workflow docs in targeted mode only.

## Out of scope (revisited)

- v1 doesn't add `freshdocs.config.*` or settings files. All behavior is determined by the existing `covers:` predicate and the new wildcard check.
- v1 doesn't retry / backoff on external link fetching. The `HEAD_TIMEOUT_MS = 5_000` bug surfaced in dogfooding is a separate fix, addressed in its own PR.
- v1 doesn't add per-org skills.sh catalog tuning. Listing on skills.sh remains telemetry-driven.
