# freshdocs — Design Spec

**Date:** 2026-05-22
**Status:** Draft (awaiting review)
**Distribution:** Public GitHub repo (`schrmm/freshdocs`) → indexed by [skills.sh](https://www.skills.sh) → installed via `npx skills add schrmm/freshdocs` across Pi, Claude Code, and other Agent-Skills hosts.

## Core intent

**Project documentation should reflect the current state of the codebase.** freshdocs systematically finds the discrepancies that break that promise and drives them to resolution — without depending on the developer remembering to look.

It is the single documentation-health package for a repo. It consolidates today's scattered tooling (`doc-sync`, `update-docs`, `claude-md-improver`, `revise-claude-md`) into one portable workflow and fills the gaps those tools left.

## What freshdocs detects (discrepancy classes)

1. **Docs-vs-code drift** — a doc describes code that has since changed (signatures, endpoints, config, behavior).
2. **Docs-vs-docs contradiction** — two docs make conflicting claims about the same thing.
3. **Consolidation need** — the same information is duplicated/fragmented across docs and should be unified (DRY, single source of truth).
4. **Coverage gap** — code areas or workflows with no documentation pointing at them.
5. **Macro staleness** — orientation docs (what the repo is, its workflows, when/who uses what) no longer match the repo's actual shape.
6. **Dead links** — broken internal references or unhealthy external URLs.
7. **Time staleness** — a doc is past its review interval regardless of detectable change.

## Principles

1. **Detection is cheap and deterministic; repair is smart and manual.** The automatic commit gate never calls an LLM. The LLM runs only when a repair command is invoked.
2. **One source of truth, thin per-platform shims.** A single `doc-gate` script + one `SKILL.md`. Pi, Claude Code, and CI all call the same script.
3. **Incremental adoption.** Docs without metadata are un-gated (one-time nudge). Never all-or-nothing.
4. **Cooperate, don't collide.** `grill-with-docs` + `CONTEXT.md` remain the authoring authority for domain language and ADRs. freshdocs *detects* staleness/discrepancy and hands substantive rewrites to `grill-with-docs`; it only makes light, mechanical updates itself.

## Consolidation (what freshdocs replaces)

| Replaced | Becomes |
|----------|---------|
| `doc-sync` skill | Core drift + DRY methodology inside the `freshdocs` skill |
| `update-docs` command | `/update-docs` repair command |
| `claude-md-improver` | CLAUDE.md/AGENTS.md treated as gated agent-context docs; currency-check folded into the gate |
| `revise-claude-md` | Session-learning capture folded into `/update-docs` (light context-file updates) |

Preserved (not replaced): `grill-with-docs`, `CONTEXT.md`, `docs/adr/`, `to-prd`.

## Documentation taxonomy & freshness model

| Class | Where | Detection model | On staleness |
|-------|-------|-----------------|--------------|
| Code-derived guides | `docs/agents/**`, `docs/**` | `docmeta covers:` globs + mechanical extractors | agent docs FAIL gate; human docs WARN |
| Macro / orientation | README, `docs/overview*`, `docs/workflows*` | time-based `review_interval` + **structural fingerprint** | WARN + review prompt |
| Agent-context files | `CLAUDE.md`, `AGENTS.md`, `CONTEXT.md` | currency vs commits + `covers:` where applicable | flag; light update by freshdocs, deep rewrite → `grill-with-docs` |
| ADRs | `docs/adr/NNNN-slug.md` | contradiction heuristic only | advisory: "consider superseding ADR-NNNN" → `grill-with-docs` |
| PRDs | GitHub issues via `to-prd` | none | n/a — reads tracker config only |

**Structural fingerprint:** a deterministic hash of the repo's shape — top-level dirs, declared commands/skills, build scripts, services. When it changes, macro docs are flagged for review (their content can't be diffed against a `covers:` glob, but their *subject* — "how this repo is organized" — provably changed).

## The `docmeta` convention

The only annotation burden. Applied to describable guides; macro docs may carry just `reviewed`/`review_interval`.

```yaml
---
audience: agent          # inferred from path; overridable
covers: ["src/api/**", "src/config/schema.py"]   # globs this doc describes (omit for macro docs)
synced: a1b2c3d          # git SHA at last confirmed-accurate
reviewed: 2026-05-22     # last review date
review_interval: 90d     # optional; default 30d agent / 90d human / 60d macro
---
```

## ADR handling (Matt Pocock format)

Per [`ADR-FORMAT.md`](https://github.com/mattpocock/skills/blob/main/skills/engineering/grill-with-docs/ADR-FORMAT.md): `docs/adr/NNNN-slug.md`, sequential; minimal core (title + 1–3 sentences); optional `Status` (proposed|accepted|deprecated|superseded by ADR-NNNN), Considered Options, Consequences; written only when hard-to-reverse + surprising + real trade-off. **Freshness = supersession, never editing.** freshdocs only flags contradictions and routes to `grill-with-docs`; it never adds `docmeta` to an ADR.

## Components

### 1. `doc-gate` (portable core — Node/TS, no LLM)

Single source of detection logic, called by the Pi extension, the Claude Code git hook, and CI.

1. Collect changed files (staged for pre-commit; PR range for CI).
2. **Path-filter:** no `covers:` glob and no structural-fingerprint change → exit 0.
3. **Drift:** flag guides whose `covers:` matched a change newer than `synced`.
4. **Extractors:** compare current signatures / routes / config keys against documented blocks → precise mismatches.
5. **Structural:** recompute fingerprint; if changed, flag macro docs.
6. **Links:** resolve internal links (broken = flag); external URL health checked in audit/scheduled mode only (network flakiness must not block commits).
7. **Contradiction:** lightweight cross-doc claim check for overlapping `covers:` sets (advisory).
8. Output flagged items by class + reason. **Exit nonzero if any agent-context or `docs/agents/` doc is stale**; WARN for human/macro; ADR + contradiction flags advisory.

### 2. `freshdocs` skill (judgment + repair — one SKILL.md)

Agent Skills standard (read by Pi `~/.pi/agent/skills/` and Claude Code). Body:
- Audience rules (`docs/agents/` terse+exact; `docs/` narrative; macro = orientation).
- **DRY / consolidation methodology** (ported from `doc-sync`): detect duplication/fragmentation, propose single-source-of-truth merges.
- Repair: reconcile flagged doc → bump `synced`/`reviewed`.
- Light context-file updates (absorbs `revise-claude-md`); deep CONTEXT.md/ADR work → `grill-with-docs`.
- Reads the `## Agent skills` block to locate tracker + docs layout.

### 3. Commands & triggers

**Triggers:** (a) commit/PR gate, (b) on-demand commands, (c) **scheduled sweep** (optional CI weekly + local command — reverses the earlier no-cron decision).

- `/doc-audit` (read-only): whole-repo run — drift, contradictions, consolidation candidates, **coverage metrics** (% of code areas with docmeta-mapped docs; undocumented surface), broken links (incl. external), overdue reviews. Reports by urgency. `--init` bootstraps `docmeta`.
- `/update-docs` (repair): gate/audit → invoke `freshdocs` skill to reconcile, consolidate, and bump frontmatter; context-file light-updates inline; ADR/CONTEXT rewrites routed to `grill-with-docs`.
- **Scheduled sweep:** runs `/doc-audit` logic on a CI cron, posts a freshness report (no edits).

## Data flow

```
commit ──► pre-commit hook runs doc-gate ──► diff + docmeta + structural fingerprint
   │           stale agent/context doc? ──► FAIL (block)
   │           stale human/macro doc?   ──► WARN
   │           broken internal link?    ──► FAIL
   │           contradiction / ADR?     ──► advisory
   ▼
dev runs /update-docs ──► freshdocs skill reconciles + consolidates ──► bumps synced/reviewed ──► passes
scheduled CI sweep ──► /doc-audit report (coverage, links, overdue) ──► no edits
```

## Portability shims (thin)

- **Pi:** TS extension registers `/doc-audit` + `/update-docs`; optional pre-commit via lifecycle event; SKILL.md in `skills/`.
- **Claude Code:** SKILL.md as skill; `.md` command wrappers; `doc-gate` as git pre-commit hook.
- **CI:** `doc-gate` on PR + scheduled sweep workflow — platform-agnostic, no agent.

## Packaging & distribution

One public GitHub repo `schrmm/freshdocs`: `SKILL.md`, `doc-gate/` (TS + extractors + fingerprint + link-checker), `commands/`, `hooks/` (pre-commit + CI + scheduled templates), `pi/` (extension shim). Indexed by skills.sh; installed via `npx skills add schrmm/freshdocs`; tracked via `skills-lock.json`. Optional `gitea.ram` mirror. Tooling repo kept separate from content.

## Out of scope (YAGNI)

- Cross-repo audit dashboards (single-repo focus for v1).
- LLM in the commit-gate path.
- Re-authoring CONTEXT.md/ADRs (owned by `grill-with-docs`).

## Open questions

- v1 extractor coverage: glob-only first vs. shipping signature/endpoint/config extractors immediately. (Leaning glob + structural fingerprint + links in v1; deep code extractors v2.)
