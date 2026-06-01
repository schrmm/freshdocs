# freshdocs skills

Public Agent Skill entrypoints for `npx skills@latest add schrmm/freshdocs --skill '*'`.

That command installs all three freshdocs skills into the project or global scope selected during the `skills.sh` setup. No extra agent configuration is needed after the installer finishes; restart the target agent if it was already running so it reloads its skill directory.

- **[freshdocs-doc-audit](./freshdocs-doc-audit/SKILL.md)** — Run the read-only documentation health audit and report coverage, reviews, internal links, and external link status.
- **[freshdocs-update-docs](./freshdocs-update-docs/SKILL.md)** — Repair existing documentation findings from `doc-gate` or `freshdocs-audit` without authoring new coverage docs from scratch.
- **[freshdocs-create-docs](./freshdocs-create-docs/SKILL.md)** — Author missing documentation for uncovered or wildcard-only source areas using a cluster-and-approve workflow.

The source repo keeps these publishable skills under top-level `skills/`, not under `.agents/skills/`, so local checkouts do not create duplicate selectable skills in agents that scan project-local install directories.
