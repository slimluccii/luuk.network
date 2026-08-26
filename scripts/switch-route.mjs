// Point a hostname at a deployment (also the rollback mechanism):
// writes /routing/<hostname>.json and purges the spike pull zone so cached
// static pages of the previous deployment disappear.
//
// Usage: node switch-route.mjs <hostname> <deploymentId> [--no-purge] [--dry-run]
// Env: BUNNY_STORAGE_ZONE, BUNNY_STORAGE_PASSWORD, BUNNY_STORAGE_ENDPOINT,
//      and for the purge: BUNNY_API_KEY, SPIKE_PULL_ZONE_ID

import { exit } from "node:process";

const args = process.argv.slice(2);
let purge = true;
let dryRun = false;
const positional = [];
for (const arg of args) {
  if (arg === "--no-purge") purge = false;
  else if (arg === "--dry-run") dryRun = true;
  else positional.push(arg);
}
const [hostname, deploymentId] = positional;
if (!hostname || !deploymentId) {
  console.error("Usage: node switch-route.mjs <hostname> <deploymentId> [--no-purge] [--dry-run]");
  exit(1);
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

const body = JSON.stringify({
  deploymentId,
  updatedAt: new Date().toISOString(),
});
console.log(`routing/${hostname}.json <- ${body}`);
if (!dryRun) {
  const response = await fetch(`${endpoint}/${zone}/routing/${hostname}.json`, {
    method: "PUT",
    headers: { AccessKey: password },
    body,
  });
  if (!response.ok) {
    console.error(`Writing routing file failed: ${response.status}`);
    exit(1);
  }
}

if (purge) {
  const apiKey = process.env.BUNNY_API_KEY;
  const pullZoneId = process.env.SPIKE_PULL_ZONE_ID;
  if (!apiKey || !pullZoneId) {
    console.warn("BUNNY_API_KEY or SPIKE_PULL_ZONE_ID missing; skipping purge");
  } else if (!dryRun) {
    const response = await fetch(
      `https://api.bunny.net/pullzone/${pullZoneId}/purgeCache`,
      { method: "POST", headers: { AccessKey: apiKey } },
    );
    if (!response.ok) {
      console.error(`Purge failed: ${response.status}`);
      exit(1);
    }
    console.log(`purged pull zone ${pullZoneId}`);
  }
}
