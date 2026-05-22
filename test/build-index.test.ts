import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildIndex } from "../src/docmeta-index.ts";

function fixture(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), "freshdocs-"));
  for (const [rel, content] of Object.entries(files)) {
    const full = join(root, rel);
    mkdirSync(join(full, ".."), { recursive: true });
    writeFileSync(full, content);
  }
  return root;
}

test("indexes gated docs and lists un-gated ones, with repo-relative POSIX paths", () => {
  const root = fixture({
    "docs/agents/api.md": "---\ncovers: [\"src/api/**\"]\nsynced: abc123\n---\nguide",
    "docs/guide.md": "---\ncovers: [\"src/util.ts\"]\n---\nhuman guide",
    "docs/bare.md": "# no frontmatter",
    "README.md": "# project",
  });
  try {
    const index = buildIndex(root);

    const paths = index.entries.map((e) => e.path).sort();
    assert.deepEqual(paths, ["docs/agents/api.md", "docs/guide.md"]);

    const api = index.entries.find((e) => e.path === "docs/agents/api.md")!;
    assert.equal(api.meta.audience, "agent");
    assert.deepEqual(api.meta.covers, ["src/api/**"]);

    const ungatedPaths = index.ungated.map((u) => u.path).sort();
    assert.deepEqual(ungatedPaths, ["README.md", "docs/bare.md"]);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("ignores node_modules, dist, and .git", () => {
  const root = fixture({
    "docs/agents/real.md": "---\ncovers: [\"src/a.ts\"]\n---\nx",
    "node_modules/pkg/readme.md": "---\ncovers: [\"x\"]\n---\nx",
    "dist/out.md": "---\ncovers: [\"x\"]\n---\nx",
    ".git/notes.md": "---\ncovers: [\"x\"]\n---\nx",
  });
  try {
    const index = buildIndex(root);
    assert.deepEqual(index.entries.map((e) => e.path), ["docs/agents/real.md"]);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
