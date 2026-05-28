---
name: freshdocs-create-docs
description: Author missing freshdocs documentation for uncovered or wildcard-only source areas. Use when the user asks to create docs, document a module, handle uncovered files, or run freshdocs create-docs. Clusters source files before drafting.
---

# freshdocs-create-docs

Author missing documentation for source areas that are uncovered or only wildcard-covered. This skill is the creation action in the freshdocs family:

- `freshdocs-doc-audit` reports documentation health and never edits files.
- `freshdocs-update-docs` repairs findings from the gate or audit.
- `freshdocs-create-docs` authors missing docs for uncovered source areas.

## Workflow

1. Determine mode:
   - No argument: sweep mode over uncovered and wildcard-only audit findings.
   - Source path or glob: targeted mode for that unit.
   - Doc path: scaffold that doc path. For workflow or orientation docs, scaffold an outline and ask the user to fill the prose.
2. Run `freshdocs-audit` first and capture uncovered and wildcard-only files.
3. Resolve `freshdocs-audit` in this order:
   - `freshdocs-audit` on PATH.
   - `node_modules/.bin/freshdocs-audit`.
   - Project `.agents/skills/freshdocs-create-docs/dist/audit-cli.cjs`.
   - Global `~/.codex/skills/freshdocs-create-docs/dist/audit-cli.cjs`.
   - Global `~/.agents/skills/freshdocs-create-docs/dist/audit-cli.cjs`.
4. Sweep mode: read every uncovered and wildcard-only source file, then propose semantic clusters. Do not draft one doc per file unless each file is genuinely independent.
5. Present the cluster proposal as: doc path -> files covered. Ask the user to approve or edit before drafting.
6. Draft each approved group:
   - Read every source file in the group.
   - Write a concise reference doc: purpose, public API, invocation, gotchas.
   - Mark unknowns as `[CLARIFY: ...]`; never invent domain language.
   - Write full docmeta: `audience: agent`, literal `covers`, current HEAD SHA as `synced`, today's date as `reviewed`, `review_interval: 30d`.
7. Review per file with the user before moving to the next group.
8. Rerun `freshdocs-audit` and confirm the uncovered list shrank by the authored docs.

## Boundaries

- If drafting requires more than two unknown business or workflow terms, stop and route to `grill-with-docs`.
- Do not edit accepted ADRs.
- Do not repair drift findings here; route that to `freshdocs-update-docs`.
