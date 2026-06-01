import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parse } from "yaml";
import { test } from "node:test";

const expectedSkills = [
  "freshdocs-doc-audit",
  "freshdocs-update-docs",
  "freshdocs-create-docs",
];

test("plugin manifest exposes the complete freshdocs skill family", () => {
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

test("npm package includes skills.sh manifest and skill directories", () => {
  const packageJson = JSON.parse(
    readFileSync(join(process.cwd(), "package.json"), "utf8"),
  ) as { files: string[] };

  assert.equal(packageJson.files.includes(".claude-plugin"), true);
  assert.equal(packageJson.files.includes("skills"), true);
});
