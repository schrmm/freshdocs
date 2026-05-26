import { build } from "esbuild";

await build({
  entryPoints: [
    "src/cli-main.ts",
    "src/audit-cli.ts",
    "src/install-commands-cli.ts",
    "src/install-hook-cli.ts",
  ],
  bundle: true,
  platform: "node",
  format: "cjs",
  target: "node22",
  outdir: "dist",
  outExtension: { ".js": ".cjs" },
});
