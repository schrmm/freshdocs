import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runAudit } from "../src/audit.ts";

function fixture(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), "freshdocs-audit-"));
  for (const [rel, content] of Object.entries(files)) {
    const full = join(root, rel);
    mkdirSync(join(full, ".."), { recursive: true });
    writeFileSync(full, content);
  }
  return root;
}

test("runAudit reports coverage stats over the supplied code files", async () => {
  const root = fixture({
    "docs/agents/api.md": '---\ncovers: ["src/a.ts"]\n---\nguide',
  });
  try {
    const report = await runAudit(root, {
      codeFiles: ["src/a.ts", "src/b.ts"],
      fetch: async () => ({ status: 200 }),
    });
    assert.equal(report.coverage.explicit, 1);
    assert.equal(report.coverage.wildcardOnly, 0);
    assert.equal(report.coverage.uncovered, 1);
    assert.equal(report.coverage.total, 2);
    assert.deepEqual(report.coverage.uncoveredFiles, ["src/b.ts"]);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("runAudit lists docs whose review interval has elapsed by `now`", async () => {
  const root = fixture({
    "docs/agents/api.md":
      '---\ncovers: ["src/a.ts"]\nreviewed: 2026-01-01\nreview_interval: 30d\n---\nguide',
    "docs/fresh.md":
      '---\ncovers: ["src/b.ts"]\nreviewed: 2026-05-01\nreview_interval: 90d\n---\nguide',
  });
  try {
    const report = await runAudit(root, {
      codeFiles: [],
      now: new Date("2026-05-23"),
      fetch: async () => ({ status: 200 }),
    });
    assert.deepEqual(report.overdue.map((o) => o.doc), ["docs/agents/api.md"]);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("runAudit reports broken internal links across ALL docs (not just changed ones)", async () => {
  const root = fixture({
    "docs/a.md": "[gone](./missing.md)",
    "docs/b.md": "fine",
  });
  try {
    const report = await runAudit(root, {
      codeFiles: [],
      fetch: async () => ({ status: 200 }),
    });
    assert.equal(report.brokenLinks.length, 1);
    assert.equal(report.brokenLinks[0]!.doc, "docs/a.md");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("runAudit classifies external URLs via the injected fetcher (no real network)", async () => {
  const root = fixture({
    "docs/a.md": "see [up](https://up.example) and [down](https://down.example)",
  });
  try {
    const report = await runAudit(root, {
      codeFiles: [],
      fetch: async (url) =>
        url === "https://up.example" ? { status: 200 } : { status: 404 },
    });
    const up = report.externalLinks.find((l) => l.url === "https://up.example")!;
    const down = report.externalLinks.find((l) => l.url === "https://down.example")!;
    assert.equal(up.ok, true);
    assert.equal(down.ok, false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("runAudit: uncovered field mirrors coverage.uncoveredFiles", async () => {
  const root = fixture({
    "docs/agents/api.md": '---\ncovers: ["src/a.ts"]\n---\nguide',
  });
  try {
    const report = await runAudit(root, {
      codeFiles: ["src/a.ts", "src/b.ts"],
      fetch: async () => null,
    });
    assert.deepEqual(report.uncovered, report.coverage.uncoveredFiles);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("runAudit treats scripts/ as first-run source surface", async () => {
  const root = fixture({
    "scripts/migrate_agent_assets.py": "print('migrate')\n",
    "README.md": "---\ncovers: []\n---\n# tool\n",
  });
  try {
    const report = await runAudit(root, {
      fetch: async () => null,
    });
    assert.equal(report.coverage.total, 1);
    assert.equal(report.coverage.uncovered, 1);
    assert.deepEqual(report.coverage.uncoveredFiles, ["scripts/migrate_agent_assets.py"]);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("runAudit ignores Python bytecode and cache directories", async () => {
  const root = fixture({
    "scripts/migrate_agent_assets.py": "print('migrate')\n",
    "scripts/__pycache__/migrate_agent_assets.cpython-312.pyc": "bytecode",
    "scripts/tool.pyc": "bytecode",
    ".pytest_cache/state": "cache",
    ".mypy_cache/cache.json": "{}",
    ".ruff_cache/cache": "cache",
    ".venv/lib/python/site-packages/pkg.py": "print('pkg')\n",
    "venv/lib/python/site-packages/pkg.py": "print('pkg')\n",
    "README.md": "---\ncovers: []\n---\n# tool\n",
  });
  try {
    const report = await runAudit(root, {
      fetch: async () => null,
    });
    assert.equal(report.coverage.total, 1);
    assert.deepEqual(report.coverage.uncoveredFiles, ["scripts/migrate_agent_assets.py"]);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
