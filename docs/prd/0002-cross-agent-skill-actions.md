# PRD: cross-agent freshdocs skill actions

> Source: synthesized from the Codex-vs-Claude install and invocation discussion. Published to GitHub Issues as [#23](https://github.com/schrmm/freshdocs/issues/23) with label `ready-for-agent`.

## Problem Statement

freshdocs currently exposes one broad Agent Skill plus Claude-style command templates. That works naturally in Claude Code, where `/freshdocs:doc-audit`, `/freshdocs:update-docs`, and `/freshdocs:create-docs` feel like selectable actions. In Codex, however, `$freshdocs` invokes one skill and does not provide an internal subcommand picker. The result is confusing: users can install freshdocs with `npx skills add schrmm/freshdocs`, but they cannot actively select `doc-audit`, `update-docs`, or `create-docs` as separate Codex actions.

## Solution

Reshape freshdocs around the same cross-agent pattern used by Matt Pocock-style skills: one installable repo, many small independently selectable skills. The primary install remains:

```sh
npx skills add schrmm/freshdocs
```

After install, users should see and invoke separate freshdocs actions in Codex:

- `freshdocs-doc-audit`
- `freshdocs-update-docs`
- `freshdocs-create-docs`

Claude Code can continue to use command adapters such as `/freshdocs:doc-audit`, but those adapters should be thin wrappers around the same skill action semantics rather than the primary conceptual model.

## User Stories

1. As a Codex user, I want to install freshdocs with one `npx skills add` command, so that setup stays simple.
2. As a Codex user, I want `doc-audit` to appear as its own selectable skill action, so that I do not need to remember prompt wording inside `$freshdocs`.
3. As a Codex user, I want `update-docs` to appear as its own selectable skill action, so that repair work starts from the right workflow.
4. As a Codex user, I want `create-docs` to appear as its own selectable skill action, so that missing-doc authoring is distinct from drift repair.
5. As a Claude Code user, I want existing `/freshdocs:*` command adapters to keep working, so that the migration does not break established workflows.
6. As a freshdocs maintainer, I want one canonical implementation of each workflow, so that Codex skills and Claude commands cannot drift apart.
7. As a freshdocs maintainer, I want `skills.sh` discovery to find only the intended public skills, so that installed users do not see duplicate `freshdocs` entries.
8. As a freshdocs maintainer, I want generated/package assets to remain lean, so that the published tarball does not include plugin metadata or nested duplicate skills by accident.
9. As a repository adopter, I want the pre-commit hook to find the vendored CLIs from a skill install, so that I do not need a separate global npm install.
10. As a repository adopter, I want command-template installation to be optional, so that Codex users are not misled into expecting slash commands.
11. As a user switching between Claude Code and Codex, I want the same conceptual actions in both tools, so that I do not need separate freshdocs mental models.
12. As a user reading the README, I want the docs to clearly distinguish skills from command adapters, so that I know what should appear in my agent UI.
13. As an agent using freshdocs, I want each skill description to state exactly when it applies, so that automatic skill selection is reliable.
14. As an agent using `freshdocs-doc-audit`, I want read-only instructions, so that audit never edits files.
15. As an agent using `freshdocs-update-docs`, I want repair instructions scoped to reported findings, so that it does not wander into unrelated documentation.
16. As an agent using `freshdocs-create-docs`, I want the cluster-and-approve workflow preserved, so that sweep mode remains controlled and navigable.

## Implementation Decisions

- Replace the single public `freshdocs` skill surface with three public action skills: `freshdocs-doc-audit`, `freshdocs-update-docs`, and `freshdocs-create-docs`.
- Keep the deterministic CLIs (`doc-gate`, `freshdocs-audit`) and existing TypeScript modules unchanged unless packaging or resolution requires a narrow adjustment.
- Treat each action skill as a small `SKILL.md` package with its own `name`, `description`, body instructions, and optional `agents/openai.yaml` metadata.
- Keep each action skill self-contained, following the Matt Pocock skills pattern. Repeat short shared principles where that improves local clarity. Add per-skill reference files only when a specific skill needs long exact formats or rules; do not create cross-skill shared references as an abstraction by default.
- Keep Claude command templates as adapters. Each command template should point at the corresponding action skill and preserve the existing `/freshdocs:*` naming for Claude Code.
- Remove or avoid Codex plugin packaging for now. The install target is Agent Skills via `skills.sh`, not Codex plugin distribution.
- Ensure `skills.sh` discovery finds the three intended action skills and does not also surface a broad duplicate `freshdocs` skill.
- Keep vendored `dist/` in the package so a skill install still contains the CLIs needed by command adapters and hook fallback.
- Keep hook bin resolution compatible with PATH, local npm, project skill install, Codex global skill install, and portable global skill install.
- Update README language to present one install command and three selectable action skills, with Claude slash commands described only as adapters.
- Keep `freshdocs-install-commands` optional and honest: it installs command templates, not Codex slash commands.

## Testing Decisions

- Good tests should verify observable packaging and invocation behavior, not implementation details.
- Add or update a packaging/discovery test or script that asserts `skills.sh` can discover exactly the intended public freshdocs skills.
- Keep CLI behavior tests focused on existing public outputs: audit report output, gate exit codes, non-behavior-change downgrades, link failures, and coverage findings.
- Add a package dry-run verification expectation that the tarball contains the action skill directories, root docs, command templates, hooks, and `dist/`, but not Codex plugin metadata or nested duplicate skill surfaces.
- Add command-template tests only if command installer behavior changes; otherwise existing installer build verification is enough.
- Continue running `npm run build`, `npm run typecheck`, `npm test`, and `npm pack --dry-run` before release.

## Out of Scope

- Building a Codex plugin UI.
- Creating true Codex slash commands for `/freshdocs:*`.
- Changing the drift/audit detection semantics.
- Reintroducing global npm install as a required path.
- Reworking issue-tracker integration or Matt Pocock setup configuration.
- Authoring new ADRs unless the skill split reveals a durable architectural decision that needs one.

## Further Notes

- The Matt Pocock skills pattern works across Codex and Claude because each action is a separate skill with specific metadata, while harness-specific UX remains an adapter layer.
- The freshdocs package should keep `npx skills add schrmm/freshdocs` as the only required install story.
- If a generic `freshdocs` skill remains useful, it should be private/internal reference material or a non-default compatibility alias, not a fourth public selectable action that competes with the action skills.
