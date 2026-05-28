import assert from "node:assert/strict";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { test } from "node:test";

test("sync-skill-dist copies only skill runtime bundles", () => {
  const root = join(tmpdir(), `freshdocs-sync-skill-dist-${process.pid}-${Date.now()}`);
  const scriptPath = join(process.cwd(), "scripts", "sync-skill-dist.mjs");

  mkdirSync(join(root, "dist"), { recursive: true });
  for (const entry of [
    "audit-cli.cjs",
    "cli-main.cjs",
    "install-commands-cli.cjs",
    "install-hook-cli.cjs",
  ]) {
    writeFileSync(join(root, "dist", entry), entry);
  }

  try {
    const result = spawnSync(process.execPath, [scriptPath], {
      cwd: root,
      encoding: "utf8",
    });

    assert.equal(result.status, 0, result.stderr || result.stdout);

    for (const skillName of [
      "freshdocs-doc-audit",
      "freshdocs-update-docs",
      "freshdocs-create-docs",
    ]) {
      const skillDist = join(root, "skills", skillName, "dist");
      assert.equal(existsSync(join(skillDist, "audit-cli.cjs")), true);
      assert.equal(existsSync(join(skillDist, "cli-main.cjs")), true);
      assert.equal(existsSync(join(skillDist, "install-commands-cli.cjs")), false);
      assert.equal(existsSync(join(skillDist, "install-hook-cli.cjs")), false);
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});