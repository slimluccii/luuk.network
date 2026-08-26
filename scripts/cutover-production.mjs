// One-shot migration of production (luuk.network) to model B: routing files,
// router deploy to the production script, purge. Also aligns the preview pull
// zone's origin and the GitHub storage-password secret, which the migration
// changed along the way. Run once; afterwards deploys go through the Deploy
// workflow.
//
// Usage: node cutover-production.mjs <deploymentId>
// Env: BUNNY_API_KEY, BUNNY_STORAGE_ZONE, BUNNY_STORAGE_PASSWORD

import { execFileSync } from "node:child_process";
import { exit } from "node:process";

const PROD_PULL_ZONE_ID = "6379899";
const PROD_SCRIPT_ID = "86200";
const PREVIEW_PULL_ZONE_ID = "6417919";
const STORAGE_ZONE_ID = 1768203; // luuk-network-static
const HOSTNAMES = ["luuk.network", "luuk-network.b-cdn.net"];

const deploymentId = process.argv[2];
if (!deploymentId) {
  console.error("Usage: node cutover-production.mjs <deploymentId>");
  exit(1);
}
const apiKey = process.env.BUNNY_API_KEY;
if (!apiKey) {
  console.error("Missing BUNNY_API_KEY");
  exit(1);
}

for (const hostname of HOSTNAMES) {
  execFileSync("node", [
    "scripts/switch-route.mjs",
    hostname,
    deploymentId,
    "--no-purge",
  ], { stdio: "inherit", env: process.env });
}

const previewOrigin = await fetch(
  `https://api.bunny.net/pullzone/${PREVIEW_PULL_ZONE_ID}`,
  {
    method: "POST",
    headers: { AccessKey: apiKey, "content-type": "application/json" },
    body: JSON.stringify({ StorageZoneId: STORAGE_ZONE_ID }),
  },
);
if (!previewOrigin.ok) {
  console.error(
    `Preview origin update failed (${previewOrigin.status}): ${await previewOrigin.text()}`,
  );
  exit(1);
}
console.log(`preview pull zone origin -> storage zone ${STORAGE_ZONE_ID}`);

execFileSync("gh", [
  "secret",
  "set",
  "BUNNY_STORAGE_PASSWORD",
  "--body",
  process.env.BUNNY_STORAGE_PASSWORD,
], { stdio: ["ignore", "inherit", "inherit"] });

execFileSync("node", ["scripts/deploy-router.mjs"], {
  stdio: "inherit",
  env: { ...process.env, BUNNY_SCRIPT_ID: PROD_SCRIPT_ID },
});

execFileSync("node", ["scripts/purge-pullzone.mjs"], {
  stdio: "inherit",
  env: { ...process.env, BUNNY_PULL_ZONE_ID: PROD_PULL_ZONE_ID },
});

console.log(`
Production is now on model B (deployment ${deploymentId}).
Rollback: redeploy the saved pre-migration script code to script ${PROD_SCRIPT_ID}
(the storage zone and pull zone were not changed).`);
