---
audience: agent
covers: ["src/install-commands-cli.ts", "src/install-hook-cli.ts"]
synced: eb07b47d0dee16b0a0b4e7406c2566cd61439ddc
reviewed: 2026-05-26
review_interval: 30d
---

# Install bins

Two one-time CLI bins that wire freshdocs into the user's environment. Both are entrypoints (declared in `package.json#bin`), both resolve their source assets from `dirname(__dirname)` so they work under either install path (`npm i -g github:` or `npx skills add`).

## `freshdocs-install-commands` (`src/install-commands-cli.ts`)

Copies the slash command markdown files into `~/.claude/commands/freshdocs/`.

```sh
freshdocs-install-commands
# → freshdocs: installed 3 slash command(s) into <home>/.claude/commands/freshdocs
#   available as /freshdocs:<name> after reloading your agent host
```

- Source: `<pkgRoot>/commands/*.md` (every `.md` file in the package's `commands/` dir).
- Target: `${homedir()}/.claude/commands/freshdocs/` — created with `recursive: true`.
- Copies are unconditional (overwrite-on-each-run). Re-running picks up newer command definitions; this is the resync path.
- Output reports the integer count and the absolute target path.

Slash commands appear as `/freshdocs:<basename-without-md>` after the agent host reloads.

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

The hook itself, once installed, resolves `doc-gate` at runtime in three tiers (PATH → `node_modules/.bin/` → `.agents/skills/freshdocs/dist/cli-main.cjs`). That logic is in `hooks/pre-commit`, not in this bin.

## Gotchas

- **`pkgRoot` derivation.** Both bins use `dirname(__dirname)`. The bins live in `dist/`, so `dirname(__dirname)` = the package root. **Do not move the compiled bins out of `dist/`** without updating this.
- **`freshdocs-install-commands` overwrites silently.** No `--force` flag, no marker check — re-running always replaces. Intentional: command files are owned by freshdocs, not the user.
- **Hook marker is the contract.** Detecting an existing freshdocs hook is purely string-based. A user who manually deletes the marker line will be treated as having a non-freshdocs hook on the next install attempt.
- **`--force` does not back up.** It directly overwrites the existing hook; users who need the old hook must preserve or merge it manually first.
