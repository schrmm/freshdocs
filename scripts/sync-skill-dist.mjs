import { copyFileSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import { join } from "node:path";

const skillNames = [
  "freshdocs-doc-audit",
  "freshdocs-update-docs",
  "freshdocs-create-docs",
];

const skillRuntimeEntries = new Set(["audit-cli.cjs", "cli-main.cjs"]);

for (const skillName of skillNames) {
  const target = join("skills", skillName, "dist");
  rmSync(target, { recursive: true, force: true });
  mkdirSync(target, { recursive: true });

  for (const entry of readdirSync("dist", { withFileTypes: true })) {
    if (!entry.isFile()) continue;
    if (!skillRuntimeEntries.has(entry.name)) continue;
    copyFileSync(join("dist", entry.name), join(target, entry.name));
  }
}
