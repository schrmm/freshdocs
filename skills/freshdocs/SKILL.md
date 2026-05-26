---
name: freshdocs
description: Reconcile documentation discrepancies surfaced by the freshdocs gate or audit — drift, broken links, consolidation needs, overdue reviews. Use when /freshdocs:update-docs is invoked, when the doc-gate has failed a commit, or when /freshdocs:doc-audit reports findings. Cooperates with grill-with-docs (CONTEXT.md / ADRs are out of scope).
audience: agent
covers: ["src/cli.ts", "src/cli-main.ts", "src/detect-engine.ts", "src/structural-fingerprint.ts", "src/link-checker.ts", "src/url-health.ts"]
synced: b99a2f4d417555178bb8c1f0652d052e4dcc46dc
reviewed: 2026-05-26
review_interval: 30d
---

# freshdocs — judgement & repair

**One job:** make project documentation reflect the current state of the codebase by reconciling the discrepancies the deterministic tooling has already found. The tooling decides *what* is wrong; this skill decides *how* to fix it.

## When this skill applies

- `/freshdocs:update-docs` was invoked.
- The doc-gate (pre-commit / CI) failed and you need to repair flagged docs.
- `/freshdocs:doc-audit` (or `freshdocs-audit`) surfaced findings worth resolving.
- The user asks to "reconcile docs", "consolidate docs", "fix doc drift".

If you are *authoring* a CONTEXT.md or ADR, **stop and hand off to `grill-with-docs`**. This skill never edits accepted ADRs and only makes light updates to CONTEXT.md.

## Inputs you need

Run the tooling first to get a precise list of work, then judge from there:

- **Gate context:** `doc-gate` against the current commit/diff produces `Finding[]` (drift / broken-link / macro-stale).
- **Audit context:** `freshdocs-audit` produces a snapshot report (coverage, overdue, broken internal links, external link health).
- **Repo policy:** gate and audit share hardcoded defaults for ignored directories and code-surface prefixes; there is no user-facing config file in v1.
- **Non-behavior changes:** `FRESHDOCS_NO_BEHAVIOR_CHANGE=1` downgrades drift findings to warnings in the pre-commit hook, but broken links still fail. Manual gate runs can use `doc-gate --no-behavior-change`.
- The `## Agent skills` block in `AGENTS.md` / `CLAUDE.md` tells you the repo's issue tracker, triage label vocabulary, and docs layout — read it before proposing consolidation.

**Bin resolution.** Both bins resolve in this order: (1) on PATH (`doc-gate`, `freshdocs-audit` — installed by `npm i -g github:schrmm/freshdocs`); (2) `node_modules/.bin/`; (3) `node .agents/skills/freshdocs/dist/cli-main.cjs` / `audit-cli.cjs` when the skill was installed via `npx skills add schrmm/freshdocs`. Use the first one that works.

## The repair loop

For each finding, in this order:

1. **Drift (`covered file changed without doc update`).** Read the diff for the covered files and the flagged doc. Reconcile: update the doc's prose to match the new behavior — be terse and exact for `docs/agents/**` and agent-context files (`CLAUDE.md`/`AGENTS.md`); narrative is acceptable for `docs/**`. After the prose is correct, set the doc's frontmatter `synced:` to the current HEAD SHA and `reviewed:` to today (`YYYY-MM-DD`), then save.

   If the gate output says the non-behavior-change override is active, verify the diff is truly mechanical (imports, comments, formatting, constant extraction with unchanged behavior). Do not bump docmeta unless the doc's described behavior or invocation changed.

2. **Broken internal links.** Resolve the intended target — was the linked file renamed, moved, or deleted? Update the link if there's a clear successor. Remove the link only if the referent is truly gone and irrelevant. Do not invent targets.

3. **Macro staleness (`repo structure changed`).** Re-read the relevant orientation doc (README, `docs/overview*`, `docs/workflows*`) end-to-end with the structural change in mind. Update only the sections affected by the shape change. Bump `reviewed` (macro docs typically have no `covers`/`synced`).

4. **Overdue reviews** (from audit). Re-read the doc against current code. If it's still accurate, just bump `reviewed`. If anything is off, treat the rest as drift.

5. **External link health** (from audit). Replace with the new URL if findable; otherwise remove the dead link or note the source's deprecation.

## The creation loop

When `/freshdocs:create-docs` is invoked (sweep or targeted), follow this loop:

1. **Audit first.** Run `freshdocs-audit` to get the `uncovered` and `wildcardOnly` lists. Sweep mode operates on these; targeted mode operates on the user-supplied path.

2. **Sweep mode: cluster semantically.** Read the source of each uncovered/wildcard-only file. Group files that belong to one cohesive subject into a single proposed doc (`docs/agents/<name>.md`). Do NOT propose one doc per file — the result must be navigable.

3. **Present the cluster proposal to the user.** Show the grouping and let them edit it before any prose is drafted.

4. **Draft per group, code-first.** For each approved group:
   - Read every source file in the group.
   - Draft a concise reference doc: purpose, public API, how it's invoked, gotchas. Lean toward terse over verbose — agent docs are reference material.
   - Mark anything you can't confidently infer from code as `[CLARIFY: ...]` inline. Never invent prose.
   - Write the file to `docs/agents/<name>.md` with full docmeta (audience: agent, covers: <literal paths>, synced: <HEAD SHA>, reviewed: <today YYYY-MM-DD>, review_interval: 30d).

5. **Review per file.** Surface the draft to the user; accept their edits before the next group.

6. **Hand off to grill-with-docs when you'd otherwise invent domain language.** If drafting requires more than ~2 unknown business / workflow / terminology terms, STOP and surface: "This doc needs domain language before I can draft confidently. Invoke `grill-with-docs` first?" Never invent terminology.

7. **Workflow / orientation docs are targeted-mode only in v1.** If sweep mode encounters a workflow doc candidate, note it but do not draft. The user invokes `/freshdocs:create-docs docs/workflows/<name>.md` explicitly.

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

## When to use which command

| Situation | First command |
|---|---|
| Fresh repo / starting adoption | `/freshdocs:doc-audit` → `/freshdocs:create-docs` (sweep) |
| Commit blocked by gate | `/freshdocs:update-docs` |
| Commit warned: new uncovered file | `/freshdocs:create-docs <path>` |
| Want to document a specific module now | `/freshdocs:create-docs <path>` |
| Quarterly review / pre-release | `/freshdocs:doc-audit` → dispatch |
| Doc contradicts accepted ADR | hand off to `grill-with-docs` (superseding ADR) |
| New CONTEXT.md / domain language needed | hand off to `grill-with-docs` |
