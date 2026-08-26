// Provision the model B spike on Bunny, reusing the site's existing storage
// zone: a middleware router script, a spike pull zone with the storage zone
// as origin, extra test hostnames, and the router's env vars.
//
// Usage: BUNNY_API_KEY=... BUNNY_STORAGE_ZONE=... BUNNY_STORAGE_PASSWORD=...
//          node provision-spike.mjs [--name luuk-network-spike] [--dry-run]

import { exit } from "node:process";

const args = process.argv.slice(2);
let name = "luuk-network-spike";
let dryRun = false;
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--name") name = args[++i];
  else if (args[i] === "--dry-run") dryRun = true;
}

const apiKey = process.env.BUNNY_API_KEY;
const storageZoneName = process.env.BUNNY_STORAGE_ZONE;
const storagePassword = process.env.BUNNY_STORAGE_PASSWORD;
if ((!apiKey || !storageZoneName || !storagePassword) && !dryRun) {
  console.error(
    "Missing BUNNY_API_KEY, BUNNY_STORAGE_ZONE or BUNNY_STORAGE_PASSWORD",
  );
  exit(1);
}

async function api(method, path, body) {
  console.log(`${method} ${path}${body ? " " + JSON.stringify(body) : ""}`);
  if (dryRun) return {};
  const response = await fetch(`https://api.bunny.net${path}`, {
    method,
    headers: { AccessKey: apiKey, "content-type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!response.ok) {
    console.error(`Failed (${response.status}): ${await response.text()}`);
    exit(1);
  }
  const text = await response.text();
  return text ? JSON.parse(text) : {};
}

const zones = await api("GET", "/storagezone?page=1&perPage=1000");
const storageZone = (zones.Items ?? zones ?? []).find?.(
  (zone) => zone.Name === storageZoneName,
);
if (!storageZone && !dryRun) {
  console.error(`Storage zone ${storageZoneName} not found`);
  exit(1);
}

const script = await api("POST", "/compute/script", {
  Name: `${name}-router`,
  ScriptType: 2,
  Code: 'console.log("model B router: waiting for first deploy");',
});

const pullZone = await api("POST", "/pullzone", {
  Name: name,
  OriginType: 2,
  StorageZoneId: storageZone?.Id,
  MiddlewareScriptId: script.Id,
  // SSR needs cookies intact and origin cache-control respected (-1);
  // the dashboard defaults strip cookies and force a 30-day cache.
  DisableCookies: false,
  CacheControlMaxAgeOverride: -1,
  IgnoreQueryStrings: false,
});

for (const hostname of [`spike-a.luuk.network`, `spike-b.luuk.network`]) {
  await api("POST", `/pullzone/${pullZone.Id}/addHostname`, {
    Hostname: hostname,
  });
}

const variables = {
  STORAGE_ZONE: storageZoneName,
  STORAGE_PASSWORD: storagePassword,
  STORAGE_ENDPOINT: process.env.BUNNY_STORAGE_ENDPOINT ??
    "https://storage.bunnycdn.com",
  PUBLIC_BASE: `https://${name}.b-cdn.net`,
  IMPORT_STRATEGY: "url",
  STATIC_STRATEGY: "rewrite",
};
for (const [key, value] of Object.entries(variables)) {
  await api("POST", `/compute/script/${script.Id}/variables/add`, {
    Name: key,
    Required: false,
    DefaultValue: value,
  });
}

console.log(`
Provisioned:
  router script  ${name}-router (id ${script.Id})
  pull zone      ${name} (id ${pullZone.Id}) -> origin ${storageZoneName}
  hostnames      https://${name}.b-cdn.net, spike-a.luuk.network, spike-b.luuk.network

Export for the other scripts:
  export SPIKE_SCRIPT_ID=${script.Id}
  export SPIKE_PULL_ZONE_ID=${pullZone.Id}

Next: node scripts/deploy-router.mjs`);
