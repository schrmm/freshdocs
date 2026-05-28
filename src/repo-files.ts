import { readdirSync } from "node:fs";
import { join, sep } from "node:path";
import { IGNORED_DIRS, isIgnoredFile } from "./repo-policy.ts";

/** Every file in the repo, as repo-relative POSIX paths. Skips ignored dirs. */
export function listFiles(repoRoot: string): Set<string> {
  const files = new Set<string>();
  const walk = (dir: string): void => {
    for (const dirent of readdirSync(dir, { withFileTypes: true })) {
      if (dirent.isDirectory()) {
        if (!IGNORED_DIRS.has(dirent.name)) walk(join(dir, dirent.name));
      } else if (dirent.isFile() && !isIgnoredFile(dirent.name)) {
        const rel = join(dir, dirent.name)
          .slice(repoRoot.length + 1)
          .split(sep)
          .join("/");
        files.add(rel);
      }
    }
  };
  walk(repoRoot);
  return files;
}
