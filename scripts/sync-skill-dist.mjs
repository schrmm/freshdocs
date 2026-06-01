import { copyFileSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import { join } from "node:path";

const skillRuntimeEntries = {
  "freshdocs-doc-audit": ["audit-cli.cjs", "cli-main.cjs"],
  "freshdocs-update-docs": ["audit-cli.cjs", "cli-main.cjs"],
  "freshdocs-create-docs": ["audit-cli.cjs", "cli-main.cjs"],
  "freshdocs-install-hook": ["install-hook-cli.cjs"],
};

for (const [skillName, runtimeEntries] of Object.entries(skillRuntimeEntries)) {
  const target = join("skills", skillName, "dist");
  rmSync(target, { recursive: true, force: true });
  mkdirSync(target, { recursive: true });
  const runtimes = new Set(runtimeEntries);

  for (const entry of readdirSync("dist", { withFileTypes: true })) {
    if (!entry.isFile()) continue;
    if (!runtimes.has(entry.name)) continue;
    copyFileSync(join("dist", entry.name), join(target, entry.name));
  }
}

const hookSkillHooks = join("skills", "freshdocs-install-hook", "hooks");
rmSync(hookSkillHooks, { recursive: true, force: true });
mkdirSync(hookSkillHooks, { recursive: true });
copyFileSync(join("hooks", "pre-commit"), join(hookSkillHooks, "pre-commit"));
