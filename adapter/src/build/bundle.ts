import { dirname, join } from "node:path";
import type { AstroIntegrationLogger } from "astro";
import { build } from "esbuild";

// The router evaluates this bundle with new Function and reads the handler
// from globalThis.__oesterHandler; Bunny's runtime refuses dynamic import().
export async function bundleServer(
  entryPath: string,
  logger: AstroIntegrationLogger,
  external: string[],
): Promise<Uint8Array> {
  const result = await build({
    entryPoints: [entryPath],
    outfile: join(dirname(entryPath), "entry.oester.js"),
    bundle: true,
    write: false,
    external,
    minify: true,
    format: "iife",
    globalName: "__oesterModule",
    footer: { js: "globalThis.__oesterHandler = __oesterModule.default;" },
    platform: "node",
    target: "esnext",
    conditions: ["deno"],
    logLevel: "silent",
  });
  for (const warning of result.warnings) {
    logger.warn(warning.text);
  }
  const output = result.outputFiles[0];
  if (!output) throw new Error("esbuild produced no output");
  return output.contents;
}
