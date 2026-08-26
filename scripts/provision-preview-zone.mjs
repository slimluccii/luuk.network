// Provision the preview infrastructure: a middleware router script and a
// pull zone with the project's storage zone as origin. Per-PR hostnames are
// added later by provision-preview.mjs; deployments and routing live in the
// same storage zone production uses.
//
// Usage: BUNNY_API_KEY=... BUNNY_STORAGE_ZONE=... node provision-preview-zone.mjs
//          [--name luuk-network-previews]

import { exit } from "node:process";

const args = process.argv.slice(2);
let name = "luuk-network-previews";
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--name") name = args[++i];
}

const apiKey = process.env.BUNNY_API_KEY;
const storageZoneName = process.env.BUNNY_STORAGE_ZONE;
if (!apiKey || !storageZoneName) {
  console.error("Missing BUNNY_API_KEY or BUNNY_STORAGE_ZONE");
  exit(1);
}

async function api(method, path, body) {
  const response = await fetch(`https://api.bunny.net${path}`, {
    method,
    headers: { AccessKey: apiKey, "content-type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!response.ok) {
    console.error(`${method} ${path} failed (${response.status}): ${await response.text()}`);
    exit(1);
  }
  const text = await response.text();
  return text ? JSON.parse(text) : {};
}

const zones = await api("GET", "/storagezone?page=1&perPage=1000");
const storageZone = (zones.Items ?? []).find((zone) => zone.Name === storageZoneName);
if (!storageZone) {
  console.error(`Storage zone ${storageZoneName} not found`);
  exit(1);
}

const script = await api("POST", "/compute/script", {
  Name: `${name}-router`,
  ScriptType: 2,
  Code: 'console.log("router: waiting for first deploy");',
});

const pullZone = await api("POST", "/pullzone", {
  Name: name,
  OriginType: 2,
  StorageZoneId: storageZone.Id,
  MiddlewareScriptId: script.Id,
  // SSR needs cookies intact and origin cache-control respected (-1);
  // the dashboard defaults strip cookies and force a 30-day cache.
  DisableCookies: false,
  CacheControlMaxAgeOverride: -1,
  IgnoreQueryStrings: false,
});

console.log(`
Provisioned:
  router script  ${name}-router (id ${script.Id})
  pull zone      ${name} (id ${pullZone.Id}) -> origin ${storageZoneName}

Next:
  node scripts/setup-router-vars.mjs ${script.Id}
  BUNNY_SCRIPT_ID=${script.Id} node scripts/deploy-router.mjs
  gh secret set PREVIEW_SCRIPT_ID --body ${script.Id}
  gh secret set PREVIEW_PULL_ZONE_ID --body ${pullZone.Id}`);
