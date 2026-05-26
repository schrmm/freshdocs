export const IGNORED_DIRS = new Set(["node_modules", "dist", ".git", ".agents"]);

// Conventional "code surface" prefixes. Configs/lockfiles/etc. are deliberately
// excluded so coverage and uncovered-file checks stay meaningful.
export const DEFAULT_CODE_PREFIXES = ["src/", "lib/", "app/", "packages/"] as const;
