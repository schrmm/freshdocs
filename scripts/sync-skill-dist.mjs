import { copyFileSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import { join } from "node:path";

const skillNames = [
  "freshdocs-doc-audit",
  "freshdocs-update-docs",
  "freshdocs-create-docs",
];

for (const skillName of skillNames) {
  const target = join(".agents", "skills", skillName, "dist");
  rmSync(target, { recursive: true, force: true });
  mkdirSync(target, { recursive: true });

  for (const entry of readdirSync("dist", { withFileTypes: true })) {
    if (!entry.isFile()) continue;
    copyFileSync(join("dist", entry.name), join(target, entry.name));
  }
}
