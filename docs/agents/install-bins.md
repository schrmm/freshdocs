---
audience: agent
covers: ["src/install-commands-cli.ts", "src/install-hook-cli.ts", "scripts/sync-skill-dist.mjs"]
synced: 1e92231fd9e42311d6ae639fff6857d93e402e7e
reviewed: 2026-05-28
review_interval: 30d
---

# Install bins

Two one-time CLI bins that wire freshdocs into the user's environment. Both are entrypoints (declared in `package.json#bin`), both resolve their source assets from `dirname(__dirname)` so they work under either install path (`npm i -g github:` or `npx skills@latest add schrmm/freshdocs --skill '*'`).

The primary skill install remains `npx skills@latest add schrmm/freshdocs --skill '*'`. That installs all three freshdocs skills into the user-selected project or global agent skill directory with no additional skill configuration. The bins below are optional wiring helpers for hooks and command-template adapters; they are not required for the three skills to appear in the target agent.

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

The package build writes bundled CLIs to root `dist/`, then runs `scripts/sync-skill-dist.mjs` to copy the skill-runtime CLIs into each publishable skill package:

- `skills/freshdocs-doc-audit/dist`
- `skills/freshdocs-update-docs/dist`
- `skills/freshdocs-create-docs/dist`

The script removes each skill's existing `dist/`, recreates it, and copies only `audit-cli.cjs` and `cli-main.cjs` from root `dist/`. This keeps the skill install path self-contained for audit and gate fallback while avoiding duplicate copies of installer-only bins (`install-commands-cli.cjs`, `install-hook-cli.cjs`) inside every action skill.

## Gotchas

- **`pkgRoot` derivation.** Both bins use `dirname(__dirname)`. The bins live in `dist/`, so `dirname(__dirname)` = the package root. **Do not move the compiled bins out of `dist/`** without updating this.
- **`freshdocs-install-commands` overwrites silently.** No `--force` flag, no marker check — re-running always replaces. Intentional: command files are owned by freshdocs, not the user.
- **Hook marker is the contract.** Detecting an existing freshdocs hook is purely string-based. A user who manually deletes the marker line will be treated as having a non-freshdocs hook on the next install attempt.
- **`--force` does not back up.** It directly overwrites the existing hook; users who need the old hook must preserve or merge it manually first.
- **Skill `dist/` is generated.** Edit root `src/` and rebuild; `sync-skill-dist.mjs` propagates the runtime bundles into each skill package. Root `dist/` still carries installer bins because `package.json#bin` points there.
