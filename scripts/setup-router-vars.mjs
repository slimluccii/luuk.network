// Set (or update) the router's env vars on an edge script, so an existing
// script can be switched to the model B router.
//
// Usage: node setup-router-vars.mjs <scriptId>
// Env: BUNNY_API_KEY, BUNNY_STORAGE_ZONE, BUNNY_STORAGE_PASSWORD,
//      BUNNY_STORAGE_ENDPOINT

import { exit } from "node:process";

const scriptId = process.argv[2];
if (!scriptId) {
  console.error("Usage: node setup-router-vars.mjs <scriptId>");
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

const apiKey = requireEnv("BUNNY_API_KEY");
const storageZone = requireEnv("BUNNY_STORAGE_ZONE");
const storagePassword = requireEnv("BUNNY_STORAGE_PASSWORD");
const storageEndpoint = process.env.BUNNY_STORAGE_ENDPOINT ||
  "https://storage.bunnycdn.com";
const headers = { AccessKey: apiKey, "content-type": "application/json" };

const variables = {
  // Router config.
  STORAGE_ZONE: storageZone,
  STORAGE_PASSWORD: storagePassword,
  STORAGE_ENDPOINT: storageEndpoint,
  IMPORT_STRATEGY: "eval",
  STATIC_STRATEGY: "rewrite",
  // The adapter's session driver reads these at render time.
  BUNNY_STORAGE_ZONE: storageZone,
  BUNNY_STORAGE_PASSWORD: storagePassword,
};

const script = await (
  await fetch(`https://api.bunny.net/compute/script/${scriptId}`, { headers })
).json();
const byName = new Map(
  (script.EdgeScriptVariables ?? []).map((v) => [v.Name, v.Id]),
);

for (const [name, value] of Object.entries(variables)) {
  const id = byName.get(name);
  const url = id
    ? `https://api.bunny.net/compute/script/${scriptId}/variables/${id}`
    : `https://api.bunny.net/compute/script/${scriptId}/variables/add`;
  const response = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify({ Name: name, Required: false, DefaultValue: value }),
  });
  if (!response.ok) {
    console.error(`${name} failed (${response.status}): ${await response.text()}`);
    exit(1);
  }
  console.log(`${name} ${id ? "updated" : "added"}`);
}
console.log(`router vars set on script ${scriptId}`);
