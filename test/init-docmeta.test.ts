import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { initDocmeta } from "../src/init-docmeta.ts";
import { parseDocmeta } from "../src/docmeta-index.ts";

function fixture(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), "freshdocs-init-"));
  for (const [rel, content] of Object.entries(files)) {
    const full = join(root, rel);
    mkdirSync(join(full, ".."), { recursive: true });
    writeFileSync(full, content);
  }
  return root;
}

test("dry-run proposes an init for every un-gated doc and writes nothing", () => {
  const root = fixture({
    "docs/agents/api.md": "# API",
    "docs/guide.md": "# Guide",
  });
  try {
    const result = initDocmeta(root, { dryRun: true });
    const paths = result.proposals.map((p) => p.path).sort();
    assert.deepEqual(paths, ["docs/agents/api.md", "docs/guide.md"]);
    assert.deepEqual(result.written, []);
    // files unchanged on disk
    assert.equal(readFileSync(join(root, "docs/agents/api.md"), "utf8"), "# API");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("assigns audience by path (docs/agents/ -> agent, docs/ -> human)", () => {
  const root = fixture({
    "docs/agents/api.md": "x",
    "docs/guide.md": "x",
  });
  try {
    const { proposals } = initDocmeta(root, { dryRun: true });
    const api = proposals.find((p) => p.path === "docs/agents/api.md")!;
    const guide = proposals.find((p) => p.path === "docs/guide.md")!;
    assert.equal(api.init.audience, "agent");
    assert.equal(guide.init.audience, "human");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("apply writes frontmatter that round-trips through parseDocmeta", () => {
  const root = fixture({
    "docs/agents/api.md": "# API",
  });
  try {
    const { written } = initDocmeta(root, { dryRun: false });
    assert.deepEqual(written, ["docs/agents/api.md"]);
    const updated = readFileSync(join(root, "docs/agents/api.md"), "utf8");
    const parsed = parseDocmeta(updated, "docs/agents/api.md");
    assert.ok(parsed.gated);
    assert.equal(parsed.entry.meta.audience, "agent");
    assert.ok(updated.endsWith("# API")); // body preserved
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("skips docs that already have a docmeta block", () => {
  const root = fixture({
    "docs/agents/already.md": '---\naudience: agent\ncovers: []\n---\nbody',
    "docs/new.md": "# New",
  });
  try {
    const { proposals } = initDocmeta(root, { dryRun: true });
    assert.deepEqual(proposals.map((p) => p.path), ["docs/new.md"]);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("does not propose docmeta for excluded markdown surfaces", () => {
  const root = fixture({
    "AGENTS.md": "# agent instructions",
    "docs/prd/0001-plan.md": "# PRD",
    "skills/README.md": "# skills",
    "skills/example/SKILL.md": "---\nname: example\ndescription: x\n---\n# Skill",
    "docs/guide.md": "# Guide",
  });
  try {
    const { proposals } = initDocmeta(root, { dryRun: true });
    assert.deepEqual(proposals.map((p) => p.path), ["docs/guide.md"]);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
