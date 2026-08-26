// Upload a build as an immutable deployment to the storage zone:
//   /deployments/<id>/client/...      dist/client
//   /deployments/<id>/server/entry.mjs
//   /deployments/<id>/manifest.json
//
// Usage: node deploy-deployment.mjs [--id <id>] [--route <hostname>]
//          [--pad-mb <n>] [--dry-run]
// Env: BUNNY_STORAGE_ZONE, BUNNY_STORAGE_PASSWORD, BUNNY_STORAGE_ENDPOINT,
//      and for --route purging: BUNNY_API_KEY, SPIKE_PULL_ZONE_ID

import { execFileSync, execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { promisify } from "node:util";
import { exit } from "node:process";

const args = process.argv.slice(2);
let id;
let routeHostname;
let padMb = 0;
let dryRun = false;
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--id") id = args[++i];
  else if (args[i] === "--route") routeHostname = args[++i];
  else if (args[i] === "--pad-mb") padMb = Number(args[++i]);
  else if (args[i] === "--dry-run") dryRun = true;
}

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    console.error(`Missing required env var ${name}`);
    exit(1);
  }
  return value;
}

const zone = requireEnv("BUNNY_STORAGE_ZONE");
const password = requireEnv("BUNNY_STORAGE_PASSWORD");
const endpoint = process.env.BUNNY_STORAGE_ENDPOINT ||
  "https://storage.bunnycdn.com";

if (!id) {
  const sha = execFileSync("git", ["rev-parse", "--short=8", "HEAD"])
    .toString().trim();
  id = `${sha}-${Date.now().toString(36)}`;
}

async function put(path, body) {
  console.log(`upload ${path} (${Math.round(body.byteLength / 1024)}KB)`);
  if (dryRun) return;
  const response = await fetch(`${endpoint}/${zone}/${path}`, {
    method: "PUT",
    headers: { AccessKey: password },
    body,
  });
  if (!response.ok) {
    throw new Error(`Upload ${path} failed: ${response.status}`);
  }
}

console.log(`deployment id: ${id}`);

await promisify(execFile)("node", [
  "scripts/deploy-storage.mjs",
  "dist/client",
  "--dest",
  `deployments/${id}/client`,
  ...(dryRun ? ["--dry-run"] : []),
], { env: process.env }).then(({ stdout }) => process.stdout.write(stdout));

let entry = await readFile("dist/server/entry.mjs");
if (padMb > 0) {
  // Script-compatible padding (the router evaluates bundles with
  // new Function, so no ESM syntax) to push past a size threshold (H3).
  const filler = Buffer.from(
    `\nvar __pad = "${"a".repeat(padMb * 1024 * 1024)}";\n`,
  );
  entry = Buffer.concat([entry, filler]);
}
await put(`deployments/${id}/server/entry.mjs`, entry);
await put(`deployments/${id}/manifest.json`, await readFile("dist/manifest.json"));

if (routeHostname) {
  execFileSync("node", [
    "scripts/switch-route.mjs",
    routeHostname,
    id,
    ...(dryRun ? ["--dry-run"] : []),
  ], { stdio: "inherit", env: process.env });
}

console.log(`deployed ${id}${routeHostname ? ` -> ${routeHostname}` : ""}`);
