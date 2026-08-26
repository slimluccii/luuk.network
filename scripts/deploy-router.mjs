// Build and deploy the router script to Bunny Edge Scripting.
//
// Usage: node deploy-router.mjs
// Env: BUNNY_API_KEY, SPIKE_SCRIPT_ID

import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { exit } from "node:process";

const apiKey = process.env.BUNNY_API_KEY;
const scriptId = process.env.SPIKE_SCRIPT_ID;
if (!apiKey || !scriptId) {
  console.error("Missing BUNNY_API_KEY or SPIKE_SCRIPT_ID");
  exit(1);
}

execFileSync("node", ["scripts/build-router.mjs"], { stdio: "inherit" });
const code = await readFile("router/dist/router.mjs", "utf8");

const update = await fetch(
  `https://api.bunny.net/compute/script/${scriptId}/code`,
  {
    method: "POST",
    headers: { AccessKey: apiKey, "content-type": "application/json" },
    body: JSON.stringify({ Code: code }),
  },
);
if (!update.ok) {
  console.error(`Code update failed (${update.status}): ${await update.text()}`);
  exit(1);
}

const publish = await fetch(
  `https://api.bunny.net/compute/script/${scriptId}/publish`,
  {
    method: "POST",
    headers: { AccessKey: apiKey, "content-type": "application/json" },
  },
);
if (!publish.ok) {
  console.error(`Publish failed (${publish.status}): ${await publish.text()}`);
  exit(1);
}
console.log(`Router deployed and published (script ${scriptId})`);
