---
name: freshdocs-install-hook
description: Install the optional freshdocs pre-commit hook into the current repository. Use when the user wants to wire doc-gate into git commits after installing freshdocs via skills.sh.
---

# freshdocs-install-hook

Install the optional freshdocs pre-commit hook into the current repository. This is a setup action in the freshdocs family:

- `freshdocs-doc-audit` reports documentation health and never edits files.
- `freshdocs-update-docs` repairs findings from the gate or audit.
- `freshdocs-create-docs` authors missing docs for uncovered source areas.
- `freshdocs-install-hook` wires the deterministic gate into `.git/hooks/pre-commit`.

## Workflow

1. Confirm the user wants the hook installed for the current repository.
2. Resolve the bundled installer in this order:
   - `freshdocs-install-hook` on PATH.
   - `node_modules/.bin/freshdocs-install-hook`.
   - Project `.agents/skills/freshdocs-install-hook/dist/install-hook-cli.cjs`.
   - Global `~/.codex/skills/freshdocs-install-hook/dist/install-hook-cli.cjs`.
   - Global `~/.agents/skills/freshdocs-install-hook/dist/install-hook-cli.cjs`.
3. Run the installer from the target repo root.
4. If it reports an existing non-freshdocs hook, stop and ask whether to merge manually or rerun with `--force`.
5. Report the installed hook path.

## Boundaries

- Do not overwrite a non-freshdocs hook unless the user explicitly approves `--force`.
- Do not edit documentation as part of hook setup.
- Do not require a global npm install; the skill-bundled installer is the expected skills.sh path.
