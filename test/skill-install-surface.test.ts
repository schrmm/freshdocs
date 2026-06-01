import assert from "node:assert/strict";
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
