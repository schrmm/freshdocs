---
name: freshdocs-doc-audit
description: Run the read-only freshdocs audit and report documentation health. Use when the user asks for freshdocs doc-audit, documentation health, coverage gaps, overdue reviews, broken internal links, external link health, or a whole-repo freshdocs audit. Makes no changes.
---

# freshdocs-doc-audit

Run the read-only freshdocs audit. This skill is the audit action in the freshdocs family:

- `freshdocs-doc-audit` reports documentation health and never edits files.
- `freshdocs-update-docs` repairs findings from the gate or audit.
- `freshdocs-create-docs` authors missing docs for uncovered source areas.

## Workflow

1. Invoke the audit from the current repository. Resolve the bin in this order:
   - `freshdocs-audit` on PATH.
   - `node_modules/.bin/freshdocs-audit`.
   - `node .agents/skills/freshdocs-doc-audit/dist/audit-cli.cjs` when installed into the project.
   - `node .agents/skills/freshdocs/dist/audit-cli.cjs` for older installs.
   - `node ~/.codex/skills/freshdocs-doc-audit/dist/audit-cli.cjs`.
   - `node ~/.codex/skills/freshdocs/dist/audit-cli.cjs` for older Codex installs.
   - `node ~/.agents/skills/freshdocs-doc-audit/dist/audit-cli.cjs`.
   - `node ~/.agents/skills/freshdocs/dist/audit-cli.cjs` for older installs.
2. Present the report grouped by section:
   - Coverage: explicit coverage percentage plus top undocumented files.
   - Overdue reviews.
   - Broken internal links.
   - External links.
3. Stay read-only. Do not fix docs from this skill.
4. If the user wants repairs, route to `freshdocs-update-docs`.
5. If the user wants missing docs authored, route to `freshdocs-create-docs`.

The commit-gate escape hatch (`FRESHDOCS_NO_BEHAVIOR_CHANGE=1`, or `doc-gate --no-behavior-change` for manual runs) does not affect audit output; audits always report the current documentation state.
