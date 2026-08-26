// Bundle router/router.ts into a single edge script at router/dist/router.mjs.

import { build } from "esbuild";
import { exit } from "node:process";

const result = await build({
  entryPoints: ["router/router.ts"],
  outfile: "router/dist/router.mjs",
  bundle: true,
  minify: true,
  format: "esm",
  platform: "node",
  target: "esnext",
  conditions: ["deno"],
});
for (const warning of result.warnings) console.warn(warning.text);

const { readFile } = await import("node:fs/promises");
const size = (await readFile("router/dist/router.mjs")).byteLength;
console.log(`router/dist/router.mjs: ${Math.round(size / 1024)}KB`);
if (size > 1024 * 1024) {
  console.error("Router exceeds Bunny's 1MB script cap");
  exit(1);
}
