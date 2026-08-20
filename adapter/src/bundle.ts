import type { AstroIntegrationLogger } from "astro";
import { build } from "esbuild";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";

/**
 * Bundle Astro's server output into a single self-contained edge script,
 * replacing the server dir contents with just the entry file.
 */
export async function bundleServer(
  serverDir: string,
  serverEntry: string,
  logger: AstroIntegrationLogger,
): Promise<void> {
  const entryPath = join(serverDir, serverEntry);
  // The bundle replaces its own input, so build in memory first.
  const result = await build({
    entryPoints: [entryPath],
    outfile: entryPath,
    bundle: true,
    write: false,
    // Bunny caps edge scripts at 1MB
    minify: true,
    format: "esm",
    platform: "node",
    target: "esnext",
    conditions: ["deno"],
    logLevel: "silent",
  });
  for (const warning of result.warnings) {
    logger.warn(warning.text);
  }
  const contents = result.outputFiles[0].contents;
  // Bunny accepts oversized scripts at deploy time but every request then
  // fails with a bare 400, so exceeding the limit must fail the build.
  if (contents.byteLength > SCRIPT_SIZE_LIMIT) {
    throw new Error(
      `Edge script is ${format(contents.byteLength)} but Bunny Edge Scripting caps scripts at ${
        format(SCRIPT_SIZE_LIMIT)
      }. Deploying it would take the site down. A heavy server-side dependency is the usual cause; prerender the page that uses it or move the work elsewhere.`,
    );
  }
  await rm(serverDir, { recursive: true, force: true });
  await mkdir(serverDir, { recursive: true });
  await writeFile(entryPath, contents);
  logger.info(
    `Bundled edge script to ${entryPath} (${format(contents.byteLength)} of ${
      format(SCRIPT_SIZE_LIMIT)
    } limit)`,
  );
}

const SCRIPT_SIZE_LIMIT = 1024 * 1024;

function format(bytes: number): string {
  return bytes >= 1024 * 1024
    ? `${(bytes / (1024 * 1024)).toFixed(2)}MB`
    : `${Math.round(bytes / 1024)}KB`;
}
