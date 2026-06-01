import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parse } from "yaml";
import { test } from "node:test";

const expectedSkills = [
  "freshdocs-doc-audit",
  "freshdocs-update-docs",
  "freshdocs-create-docs",
];

test("canonical skills directory exposes the complete freshdocs skill family", () => {
  const skillsRoot = join(process.cwd(), "skills");
  const skillDirs = readdirSync(skillsRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .filter((entry) => existsSync(join(skillsRoot, entry.name, "SKILL.md")))
    .map((entry) => entry.name)
    .sort();

  assert.deepEqual(skillDirs, [...expectedSkills].sort());
  for (const skillName of expectedSkills) {
    const skillPath = join(process.cwd(), "skills", skillName, "SKILL.md");
    assert.equal(existsSync(skillPath), true, `${skillName} must have SKILL.md`);

    const content = readFileSync(skillPath, "utf8");
    const frontmatter = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    assert.notEqual(frontmatter, null, `${skillName} must have frontmatter`);

    const metadata = parse(frontmatter![1]) as {
      name?: string;
      description?: string;
    };
    assert.equal(metadata.name, skillName);
    assert.equal(typeof metadata.description, "string");
    assert.notEqual(metadata.description.trim(), "");
  }
});

test("claude plugin manifest is only an adapter over canonical skills", () => {
  const manifestPath = join(process.cwd(), ".claude-plugin", "plugin.json");
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as {
    name: string;
    skills: string[];
  };

  assert.equal(manifest.name, "freshdocs");
  assert.deepEqual(
    manifest.skills,
    expectedSkills.map((skillName) => `./skills/${skillName}`),
  );
});

test("npm package includes canonical skills and optional adapter assets", () => {
  const packageJson = JSON.parse(
    readFileSync(join(process.cwd(), "package.json"), "utf8"),
  ) as { files: string[] };

  assert.equal(packageJson.files.includes("skills"), true);
  assert.equal(packageJson.files.includes(".claude-plugin"), true);
  assert.equal(packageJson.files.includes(".agents"), false);
});

test("npm pack surface contains skill runtime assets and no install targets", () => {
  const npmPackArgs = ["pack", "--dry-run", "--json", "--ignore-scripts"];
  const npmExecPath = process.env.npm_execpath;
  const result = npmExecPath
    ? spawnSync(process.execPath, [npmExecPath, ...npmPackArgs], {
        cwd: process.cwd(),
        encoding: "utf8",
      })
    : spawnSync("npm", npmPackArgs, {
        cwd: process.cwd(),
        encoding: "utf8",
      });
  assert.equal(result.status, 0, result.stderr || result.stdout);

  const packs = JSON.parse(result.stdout) as Array<{
    files: Array<{ path: string }>;
  }>;
  const paths = new Set(packs[0]!.files.map((file) => file.path));

  for (const skillName of expectedSkills) {
    assert.equal(paths.has(`skills/${skillName}/SKILL.md`), true);
    assert.equal(paths.has(`skills/${skillName}/dist/audit-cli.cjs`), true);
    assert.equal(paths.has(`skills/${skillName}/dist/cli-main.cjs`), true);
  }

  for (const path of [
    "dist/audit-cli.cjs",
    "dist/cli-main.cjs",
    "dist/install-commands-cli.cjs",
    "dist/install-hook-cli.cjs",
    "commands/doc-audit.md",
    "commands/update-docs.md",
    "commands/create-docs.md",
    "hooks/pre-commit",
  ]) {
    assert.equal(paths.has(path), true, `${path} must be packed`);
  }

  for (const path of paths) {
    assert.equal(path.startsWith(".agents/"), false, `${path} must not be packed`);
  }
});
