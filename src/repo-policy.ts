export const IGNORED_DIRS = new Set([
  "node_modules",
  "dist",
  "build",
  "coverage",
  ".git",
  ".agents",
  ".venv",
  "venv",
  "__pycache__",
  ".pytest_cache",
  ".mypy_cache",
  ".ruff_cache",
  ".tox",
]);

export const IGNORED_FILE_SUFFIXES = [
  ".pyc",
  ".pyo",
  ".pyd",
] as const;

export function isIgnoredFile(name: string): boolean {
  return IGNORED_FILE_SUFFIXES.some((suffix) => name.endsWith(suffix));
}

export const DOCMETA_IGNORED_PATHS = new Set([
  "AGENTS.md",
]);

export const DOCMETA_IGNORED_PREFIXES = [
  "docs/prd/",
  "skills/",
] as const;

export function isDocmetaIgnoredPath(path: string): boolean {
  return DOCMETA_IGNORED_PATHS.has(path)
    || DOCMETA_IGNORED_PREFIXES.some((prefix) => path.startsWith(prefix));
}

// Conventional "code surface" prefixes. Configs/lockfiles/etc. are deliberately
// excluded so coverage and uncovered-file checks stay meaningful. `scripts/`
// is included because small skill/tooling repos often put their primary
// implementation there instead of under `src/`.
export const DEFAULT_CODE_PREFIXES = ["src/", "lib/", "app/", "packages/", "scripts/"] as const;
