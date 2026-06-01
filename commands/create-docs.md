---
description: Author missing per-module / workflow / orientation docs. Sweep mode walks all uncovered findings; targeted mode authors a specific unit. Hands off to grill-with-docs for domain-language territory.
audience: agent
covers: ["src/audit-cli.ts", "src/audit.ts", "src/coverage.ts", "src/detect-engine.ts"]
synced: 4b938fb8baadb323dd016c1fc11535be1a2aa48d
reviewed: 2026-06-01
review_interval: 30d
---

Use the `freshdocs-create-docs` skill to author missing documentation for this repo.

1. Activate the `freshdocs-create-docs` skill (read its SKILL.md) before doing anything else. The creation loop is documented there.

2. Determine the mode:
   - **No argument** → sweep mode. Walk every uncovered / wildcard-only finding from the audit.
   - **Argument is a source path or glob** → targeted mode for that unit; the doc location is inferred (`docs/agents/<name>.md`).
   - **Argument is a doc path** → scaffold at that path. For `docs/workflows/<name>.md` and `docs/overview.md`, scaffold a structured outline and ask the user to fill the prose.

3. **Audit first.** Run `freshdocs-audit` and capture the repo-relative `uncovered` + `wildcardOnly` lists from the report. The CLI prints the first 20 paths per section; if a section is truncated, run a targeted follow-up or inspect the repo before drafting.
   - Bin resolution: try `freshdocs-audit` on PATH; fall back to `node_modules/.bin/freshdocs-audit`; then project `.agents/skills/freshdocs-create-docs/dist/audit-cli.cjs`; then global `~/.codex/skills/freshdocs-create-docs/dist/audit-cli.cjs`; then global `~/.agents/skills/freshdocs-create-docs/dist/audit-cli.cjs`.
   - The default code surface comes from freshdocs' shared repo policy (`src/`, `lib/`, `app/`, `packages/`, `scripts/`); targeted mode can still operate on an explicit source path outside that set.

4. **Sweep mode: cluster and propose.**
   - Read every source file in the uncovered + wildcard-only sets.
   - Propose a per-module clustering. Files that share purpose go into one doc; one-doc-per-file is rarely right.
   - Surface the proposal to the user as a table: doc path → files it'll cover. Ask for approval / edits before drafting anything.

5. **Draft each approved group.**
   - Read every source file in the group.
   - Author a concise reference doc (purpose, public API, invocation, gotchas).
   - Inline `[CLARIFY: ...]` markers for anything you can't infer from code; never invent prose.
   - Write to `docs/agents/<name>.md` with full docmeta:
     ```yaml
     ---
     audience: agent
     covers: [<literal file paths>]
     synced: <current HEAD SHA>
     reviewed: <today YYYY-MM-DD>
     review_interval: 30d
     ---
     ```

6. **Review per file.** Show the draft to the user. Accept their edits. Save. Move to the next group.

7. **Hand off to `grill-with-docs`** the moment drafting would require >2 unknown domain terms. Do not silently invent terminology. Surface: "This doc needs domain language. Invoke `grill-with-docs` first?"

8. **Do not edit accepted ADRs or do substantive CONTEXT.md rewrites** — same as `/freshdocs:update-docs`.

9. **After every draft, stage** the new doc(s) (do not commit on the user's behalf unless they asked).

10. **Re-run `freshdocs-audit`** at the end. Confirm the `uncovered` list shrank by what you authored. Surface any remaining gaps.
