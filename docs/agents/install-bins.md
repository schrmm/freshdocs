---
audience: agent
covers: ["src/install-commands-cli.ts", "src/install-hook-cli.ts", "scripts/sync-skill-dist.mjs"]
synced: 4b938fb8baadb323dd016c1fc11535be1a2aa48d
reviewed: 2026-06-01
review_interval: 30d
---

# Install bins

Two one-time CLI bins wire freshdocs into the user's environment when installed as an npm package. Both are entrypoints declared in `package.json#bin` and resolve source assets from `dirname(__dirname)`.

The primary skill install remains `npx skills@latest add schrmm/freshdocs`. `skills.sh` discovers the freshdocs skills and lets the user select which ones to install into the selected project or global agent skill directory. The `freshdocs-install-hook` skill is the skills-native hook setup path; `freshdocs-install-commands` remains an npm-package bin for direct command-template installation.

## `freshdocs-install-commands` (`src/install-commands-cli.ts`)

Copies the command markdown files into `~/.agents/commands/freshdocs/` by default. With `--claude`, copies the same templates into `~/.claude/commands/freshdocs/` as Claude Code slash-command adapters.

```sh
freshdocs-install-commands
# → freshdocs: installed 3 command template(s) into <home>/.agents/commands/freshdocs
#   use freshdocs through the installed skill where your agent supports skills

freshdocs-install-commands --claude
# → freshdocs: installed 3 command template(s) into <home>/.claude/commands/freshdocs
#   Claude Code exposes these as /freshdocs:<name> after reloading
```

- Source: `<pkgRoot>/commands/*.md` (every `.md` file in the package's `commands/` dir).
- Target: `${homedir()}/.agents/commands/freshdocs/`, or `${homedir()}/.claude/commands/freshdocs/` with `--claude` — created with `recursive: true`.
- Copies are unconditional (overwrite-on-each-run). Re-running picks up newer command definitions; this is the resync path.
- Output reports the integer count and the absolute target path.

Claude slash commands appear as `/freshdocs:<basename-without-md>` after Claude Code reloads. Codex uses the installed skills, not these templates, as its action surface.

## `freshdocs-install-hook` (`src/install-hook-cli.ts`)

Copies the pre-commit hook into the current repo's `.git/hooks/pre-commit`.

```sh
freshdocs-install-hook            # safe install
freshdocs-install-hook --force    # overwrite a non-freshdocs hook
```

Resolution & safety:
1. Resolves `gitDir` via `git rev-parse --git-dir` in `process.cwd()`. **Not a git repo → exit 1** with `freshdocs: not a git repository (cwd has no .git)`.
2. Source: `<pkgRoot>/hooks/pre-commit`. Missing → exit 1 with the absolute source path.
3. Target: `<cwd>/<gitDir>/hooks/pre-commit` (resolved, so worktrees / submodules land in the right place).
4. **Clobber protection.** If `target` exists and is not a freshdocs hook, exit 1 unless `--force` is passed.
   - "Is a freshdocs hook" = the file contains the literal string `freshdocs documentation gate (pre-commit)` (constant `FRESHDOCS_HOOK_MARKER`). The marker lives in `hooks/pre-commit`'s comment header — do not rename it without updating both files.
5. `chmodSync(target, 0o755)` — wrapped in try/catch because Windows throws on chmod (no-op there; `cmd`/`bash` shims use `.cmd` extension anyway).

The hook itself, once installed, resolves `doc-gate` at runtime in five tiers (PATH → `node_modules/.bin/` → project `.agents/skills/freshdocs-update-docs/dist/cli-main.cjs` → global `~/.codex/skills/freshdocs-update-docs/dist/cli-main.cjs` → global `~/.agents/skills/freshdocs-update-docs/dist/cli-main.cjs`). That logic is in `hooks/pre-commit`, not in this bin. The hook also honors `FRESHDOCS_NO_BEHAVIOR_CHANGE=1`, which downgrades drift findings to warnings for explicitly non-behavioral commits while leaving broken-link failures intact.

## Skill dist sync (`scripts/sync-skill-dist.mjs`)

The package build writes bundled CLIs to root `dist/`, then runs `scripts/sync-skill-dist.mjs` to copy skill-runtime assets into each publishable skill package:

- `skills/freshdocs-doc-audit/dist`
- `skills/freshdocs-update-docs/dist`
- `skills/freshdocs-create-docs/dist`
- `skills/freshdocs-install-hook/dist` plus `skills/freshdocs-install-hook/hooks/pre-commit`

The script removes each skill's existing `dist/`, recreates it, and copies only the runtime files that skill needs. Audit/update/create receive `audit-cli.cjs` and `cli-main.cjs`; install-hook receives `install-hook-cli.cjs` and the hook template. This keeps the skill install path self-contained while avoiding duplicate copies of installer-only bins inside every action skill.

## Gotchas

- **`pkgRoot` derivation.** Both bins use `dirname(__dirname)`. The bins live in `dist/`, so `dirname(__dirname)` = the package root. **Do not move the compiled bins out of `dist/`** without updating this.
- **`freshdocs-install-commands` overwrites silently.** No `--force` flag, no marker check — re-running always replaces. Intentional: command files are owned by freshdocs, not the user.
- **Hook marker is the contract.** Detecting an existing freshdocs hook is purely string-based. A user who manually deletes the marker line will be treated as having a non-freshdocs hook on the next install attempt.
- **`--force` does not back up.** It directly overwrites the existing hook; users who need the old hook must preserve or merge it manually first.
- **Skill `dist/` is generated.** Edit root `src/` and rebuild; `sync-skill-dist.mjs` propagates the runtime bundles into each skill package. Root `dist/` still carries installer bins because `package.json#bin` points there.
