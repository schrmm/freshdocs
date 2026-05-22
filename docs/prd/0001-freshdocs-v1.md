# PRD: freshdocs v1

> Source: synthesized from design spec `docs/specs/2026-05-22-freshdocs-design.md`. Published to the issue tracker with label `ready-for-agent`.

## Problem Statement

As a solo developer running multiple agent-supported repos, my documentation drifts out of sync with the code, and I have no reliable way to know when it has. The tooling I already use (`doc-sync`, `update-docs`, `claude-md-improver`, `revise-claude-md`) only acts when I remember to run it, so freshness depends on my diligence. The result is documentation I can't trust to reflect the current state of the codebase — for either human readers or the agents I work with.

## Solution

freshdocs is a portable Agent-Skills package that makes documentation discrepancies **fail loudly** instead of rotting silently. A deterministic gate runs at commit/PR time (and on a scheduled CI sweep) and blocks when agent-facing docs no longer match reality; LLM-assisted repair runs only on demand. It consolidates my four existing doc tools into one workflow and cooperates with `grill-with-docs`/`CONTEXT.md` rather than replacing them. One install (`npx skills add schrmm/freshdocs`) works across Pi, Claude Code, and CI.

## User Stories

1. As a developer, I want a commit to fail when I change code that an agent-facing doc describes without updating that doc, so that agents never read fiction.
2. As a developer, I want human-facing docs to warn (not block) on drift, so that prose lag doesn't halt my work.
3. As a developer, I want the gate to skip commits that touch no documented area, so that it never slows down unrelated work.
4. As a developer, I want a single command to audit the whole repo's documentation health, so that I can see every discrepancy at once.
5. As a developer, I want a single command to repair flagged docs with LLM help, so that fixing drift is one step, not a manual hunt.
6. As a developer, I want each describable doc to declare what code it covers, so that drift detection is precise and deterministic.
7. As a developer, I want docs to record when they were last confirmed-accurate and last reviewed, so that time-based staleness is visible even without a code change.
8. As a developer, I want orientation docs (what the repo is, its workflows, who/when to use what) flagged when the repo's shape changes, so that macro documentation stays true even though it maps to no single code path.
9. As a developer, I want broken internal doc links to fail the gate, so that references never dangle.
10. As a developer, I want external URL health checked during audits and scheduled sweeps (not at commit), so that network flakiness never blocks a commit.
11. As a developer, I want a coverage report showing which code areas have no mapped documentation, so that I can see undocumented surface area.
12. As a developer, I want duplicated or fragmented documentation surfaced as consolidation candidates, so that I can keep a single source of truth.
13. As a developer, I want contradictions between two docs that cover the same area surfaced, so that conflicting claims get reconciled.
14. As a developer, I want `CLAUDE.md`/`AGENTS.md`/`CONTEXT.md` treated as gated agent-context docs, so that the files agents rely on stay current.
15. As a developer, I want light context-file updates applied automatically and deep rewrites routed to `grill-with-docs`, so that authoring authority stays where it belongs.
16. As a developer, I want ADRs kept fresh by supersession rather than editing, so that Matt Pocock's ADR format and decision history are preserved.
17. As a developer, I want a scheduled CI sweep to post a documentation-health report, so that slow-burn staleness surfaces without my involvement.
18. As a developer, I want docs without `docmeta` to be un-gated with a one-time nudge, so that I can adopt the system incrementally.
19. As a developer, I want one detection engine shared by the commit hook, CI, and the audit command, so that all three agree and never drift apart.
20. As a developer, I want the package installable across Pi, Claude Code, and CI from one repo, so that I maintain one source of truth.
21. As a developer, I want the commit gate to never call an LLM, so that it is fast, free, and runs in vanilla CI.
22. As an agent dispatched to implement a feature, I want the repo's docs to match the code, so that I act on accurate context.

## Implementation Decisions

**Architecture — detect cheap, repair smart.** A deterministic detection core (no LLM) powers the commit/PR gate and scheduled CI sweep; LLM-assisted reconciliation runs only via on-demand commands. One detection engine is shared by all entry points so the hook, CI, and audit can never diverge.

**Four deep modules** (behind a thin `doc-gate` CLI; reporter logic folds into the CLI):

1. **docmeta-index** — `buildIndex(repoRoot) → DocIndex`. Parses `docmeta` frontmatter across all docs into one queryable index (path, audience, `covers`, `synced`, `reviewed`, `review_interval`). Audience inferred from path (`docs/agents/**` → agent, `docs/**` → human), overridable. Tolerant of missing/malformed frontmatter (un-gated, nudge).
2. **structural-fingerprint** — `fingerprint(repoRoot) → Hash`, `diff(a, b) → Change[]`. Deterministic hash of repo shape (top-level dirs, declared commands/skills, build scripts, services). A change flags macro/orientation docs for review.
3. **detect-engine** — `detect(changeSet, index, fingerprints) → Finding[]`. Pure function, no I/O. Produces findings for: docs-vs-code drift (`covers` glob matched a change newer than `synced`), internal broken links, coverage gaps, docs-vs-docs contradictions (overlapping `covers` sets), and macro staleness (from fingerprint diff). Coverage and internal-link logic live here as finding-producers.
4. **url-health** — `check(urls, {fetch}) → LinkFinding[]`. The isolated I/O seam for external URL health, with an injectable fetcher. Used only by audit and scheduled sweep, never the commit gate.

**`docmeta` frontmatter convention** — the only annotation burden, applied to describable guides; macro docs may carry only `reviewed`/`review_interval`. Fields: `audience`, `covers` (globs; omitted for macro), `synced` (git SHA), `reviewed` (date), `review_interval` (default 30d agent / 90d human / 60d macro).

**Severity contract (reporter, in CLI):** agent-context and `docs/agents/**` drift and broken internal links → nonzero exit (block). Human/macro staleness → warn. Contradiction and ADR-supersession → advisory. External URL health → audit/sweep only.

**Documentation taxonomy & ownership:** code-derived guides, macro/orientation docs, agent-context files (`CLAUDE.md`/`AGENTS.md`/`CONTEXT.md`), ADRs (`docs/adr/NNNN-slug.md`), PRDs (issues via `to-prd`). freshdocs owns *freshness/detection*; `grill-with-docs` retains *authoring* of `CONTEXT.md` and ADRs. ADRs follow Matt Pocock's `ADR-FORMAT.md`; freshness = supersession, never editing; freshdocs only flags contradictions and routes to `grill-with-docs`.

**Commands & triggers:** `/doc-audit` (read-only whole-repo report incl. coverage + external links; `--init` bootstraps `docmeta`), `/update-docs` (LLM repair + consolidation + frontmatter bump; light context-file updates inline). Triggers: commit/PR gate, on-demand commands, scheduled CI sweep.

**Portability shims (thin adapters, integration-tested only):** Pi TS extension (registers commands, optional pre-commit lifecycle hook), Claude Code (SKILL.md + `.md` command wrappers + git pre-commit hook), CI (PR workflow + scheduled-sweep workflow). All call the same `doc-gate` CLI.

**Consolidation:** replaces `doc-sync` (DRY methodology → freshdocs skill), `update-docs` (→ `/update-docs`), `claude-md-improver` (currency-check → gate), `revise-claude-md` (session capture → `/update-docs`).

**v1 cut-line (lead decision):** ship the gate with glob-based drift + structural fingerprint + internal link check, plus `/doc-audit` (coverage + external links) and `/update-docs`, with the Claude Code shim. **Defer to v2:** code extractors (signatures/routes/config), the Pi extension, the scheduled CI sweep, and the cross-doc contradiction check. This delivers a working detect→repair loop fastest.

## Testing Decisions

Good tests verify **external behavior, not implementation details** — given inputs (a repo fixture, a change set, a doc index), assert the `Finding[]` / report / exit code, never internal call sequences. Keep the suite **lean and fast**: a small set of representative cases per module, not exhaustive enumeration.

Modules to test (all four core modules):
- **detect-engine** — table-driven cases over `(changeSet, index, fingerprints)` → expected findings: drift hit/miss across `synced` boundary, path-filter skip, broken internal link, coverage gap, macro flag on fingerprint change.
- **structural-fingerprint** — same shape → same hash; shape change → expected `diff`.
- **docmeta-index** — well-formed, partial, missing, and malformed frontmatter → correct index entries / un-gated handling.
- **url-health** — injected fake fetcher → healthy vs broken classification (no real network).

Prior art: follow the project's standard test runner once chosen during implementation; fixtures as small temp repos.

## Out of Scope

- Cross-repo audit dashboards (single-repo focus for v1).
- LLM anywhere in the commit-gate path.
- Re-authoring `CONTEXT.md` / ADRs (owned by `grill-with-docs`).
- v2 items above (code extractors, Pi extension, scheduled sweep, contradiction check) — specced but not built in v1.

## Further Notes

- Distributed as one public repo `schrmm/freshdocs`, indexed by skills.sh, installed via `npx skills add schrmm/freshdocs`, tracked via `skills-lock.json`; optional `gitea.ram` mirror. Tooling repo kept separate from content repos.
- Honors the user's conventions: `npx skills add` (not `cp -r`), separate dev/content repos, no guessing on external facts.
