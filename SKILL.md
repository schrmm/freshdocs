---
name: freshdocs
description: Reconcile documentation discrepancies surfaced by the freshdocs gate or audit — drift, broken links, consolidation needs, overdue reviews. Use when /update-docs is invoked, when the doc-gate has failed a commit, or when /doc-audit reports findings. Cooperates with grill-with-docs (CONTEXT.md / ADRs are out of scope).
audience: agent
covers: ["src/cli.ts", "src/cli-main.ts", "src/detect-engine.ts", "src/structural-fingerprint.ts", "src/link-checker.ts", "src/url-health.ts"]
synced: 30349b96270d29e9154cc5e36bcf4d2d29aa9a17
reviewed: 2026-05-24
review_interval: 30d
---

# freshdocs — judgement & repair

**One job:** make project documentation reflect the current state of the codebase by reconciling the discrepancies the deterministic tooling has already found. The tooling decides *what* is wrong; this skill decides *how* to fix it.

## When this skill applies

- `/update-docs` was invoked.
- The doc-gate (pre-commit / CI) failed and you need to repair flagged docs.
- `/doc-audit` (or `freshdocs-audit`) surfaced findings worth resolving.
- The user asks to "reconcile docs", "consolidate docs", "fix doc drift".

If you are *authoring* a CONTEXT.md or ADR, **stop and hand off to `grill-with-docs`**. This skill never edits accepted ADRs and only makes light updates to CONTEXT.md.

## Inputs you need

Run the tooling first to get a precise list of work, then judge from there:

- **Gate context:** `doc-gate` against the current commit/diff produces `Finding[]` (drift / broken-link / macro-stale).
- **Audit context:** `freshdocs-audit` produces a snapshot report (coverage, overdue, broken internal links, external link health).
- The `## Agent skills` block in `AGENTS.md` / `CLAUDE.md` tells you the repo's issue tracker, triage label vocabulary, and docs layout — read it before proposing consolidation.

**Bin resolution.** Both bins resolve in this order: (1) on PATH (`doc-gate`, `freshdocs-audit` — installed by `npm i -g github:schrmm/freshdocs`); (2) `node_modules/.bin/`; (3) `node .agents/skills/freshdocs/dist/cli-main.cjs` / `audit-cli.cjs` when the skill was installed via `npx skills add schrmm/freshdocs`. Use the first one that works.

## The repair loop

For each finding, in this order:

1. **Drift (`covered file changed without doc update`).** Read the diff for the covered files and the flagged doc. Reconcile: update the doc's prose to match the new behavior — be terse and exact for `docs/agents/**` and agent-context files (`CLAUDE.md`/`AGENTS.md`); narrative is acceptable for `docs/**`. After the prose is correct, set the doc's frontmatter `synced:` to the current HEAD SHA and `reviewed:` to today (`YYYY-MM-DD`), then save.

2. **Broken internal links.** Resolve the intended target — was the linked file renamed, moved, or deleted? Update the link if there's a clear successor. Remove the link only if the referent is truly gone and irrelevant. Do not invent targets.

3. **Macro staleness (`repo structure changed`).** Re-read the relevant orientation doc (README, `docs/overview*`, `docs/workflows*`) end-to-end with the structural change in mind. Update only the sections affected by the shape change. Bump `reviewed` (macro docs typically have no `covers`/`synced`).

4. **Overdue reviews** (from audit). Re-read the doc against current code. If it's still accurate, just bump `reviewed`. If anything is off, treat the rest as drift.

5. **External link health** (from audit). Replace with the new URL if findable; otherwise remove the dead link or note the source's deprecation.

## DRY and consolidation methodology

When reading docs to reconcile, also notice:

- **Duplicated information** — the same fact stated in two or more docs. Pick the *most authoritative location* (closest to the code, or the canonical guide) as the single source of truth; rewrite the other locations to link, not restate.
- **Fragmented information** — one logical topic scattered across files. Propose a merge; do not force it without surfacing the proposal first.
- **Contradictions** — two docs make conflicting claims. Determine which matches the code; correct the other.

Surface large consolidation proposals to the user before executing them. Small DRY fixes (de-duplicating a paragraph) you can apply inline.

## Context files (CLAUDE.md / AGENTS.md / CONTEXT.md)

These are gated agent-context docs.

- **CLAUDE.md / AGENTS.md** — apply session learnings and recently-discovered conventions as light updates. Keep root files near ~100–150 lines; if they grow, propose splitting into nested per-directory files rather than padding the root.
- **CONTEXT.md** — light updates only (typos, terminology corrections matching new code). For domain-language work or substantive rewrites, **hand off to `grill-with-docs`**.

## ADRs (`docs/adr/NNNN-slug.md`)

ADRs follow Matt Pocock's `ADR-FORMAT.md`. Freshness = **supersession, never editing**.

- If a code change contradicts an accepted ADR, do **not** edit the ADR. Hand off to `grill-with-docs` to write a *superseding* ADR with the new decision.
- Never add `docmeta` to an ADR.
- ADRs are written only when the decision is hard-to-reverse, surprising without context, and had real alternatives.

## After repair

Run `doc-gate` (and/or `freshdocs-audit`) again to confirm the previously-flagged docs now pass. If any finding remains, repeat the loop. Then either let the user commit, or stage the reconciled docs alongside the original code change so the gate passes on the next commit.

## What this skill does NOT do

- Author CONTEXT.md or new ADRs from scratch — that's `grill-with-docs`.
- Author PRDs — that's `to-prd`.
- Run the detection itself — that's `doc-gate` and `freshdocs-audit`. Always use them to get the list of work; never guess.
- Touch documentation outside the flagged set unless you are doing a sanctioned consolidation pass.
