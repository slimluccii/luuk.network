// Tear down a preview hostname: routing file, its deployments (by id prefix),
// the pull zone hostname and the DNS record.
//
// Usage: node destroy-preview.mjs <hostname> [--prefix <deploymentIdPrefix>]
// Env: BUNNY_API_KEY, BUNNY_PULL_ZONE_ID,
//      BUNNY_STORAGE_ZONE, BUNNY_STORAGE_PASSWORD, BUNNY_STORAGE_ENDPOINT

import { exit } from "node:process";

const args = process.argv.slice(2);
let prefix;
let hostname;
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--prefix") prefix = args[++i];
  else hostname = args[i];
}
if (!hostname) {
  console.error("Usage: node destroy-preview.mjs <hostname> [--prefix <deploymentIdPrefix>]");
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
const pullZoneId = requireEnv("BUNNY_PULL_ZONE_ID");
const storageZone = requireEnv("BUNNY_STORAGE_ZONE");
const storagePassword = requireEnv("BUNNY_STORAGE_PASSWORD");
const storageEndpoint = process.env.BUNNY_STORAGE_ENDPOINT ||
  "https://storage.bunnycdn.com";

async function api(method, path, body) {
  const response = await fetch(`https://api.bunny.net${path}`, {
    method,
    headers: { AccessKey: apiKey, "content-type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!response.ok) {
    throw new Error(`${method} ${path} failed (${response.status}): ${await response.text()}`);
  }
  const text = await response.text();
  return text ? JSON.parse(text) : {};
}

function storageUrl(path) {
  return `${storageEndpoint}/${storageZone}/${path}`;
}

const routing = await fetch(storageUrl(`routing/${hostname}.json`), {
  method: "DELETE",
  headers: { AccessKey: storagePassword },
});
console.log(`routing file: ${routing.ok ? "deleted" : `not deleted (${routing.status})`}`);

if (prefix) {
  const listing = await fetch(storageUrl("deployments/"), {
    headers: { AccessKey: storagePassword },
  });
  const entries = listing.ok ? await listing.json() : [];
  for (const entry of entries) {
    if (!entry.IsDirectory || !entry.ObjectName.startsWith(prefix)) continue;
    const response = await fetch(
      storageUrl(`deployments/${entry.ObjectName}/`),
      { method: "DELETE", headers: { AccessKey: storagePassword } },
    );
    console.log(
      `deployment ${entry.ObjectName}: ${response.ok ? "deleted" : `failed (${response.status})`}`,
    );
  }
}

try {
  await api("DELETE", `/pullzone/${pullZoneId}/removeHostname`, {
    Hostname: hostname,
  });
  console.log(`pullzone: removed ${hostname}`);
} catch (error) {
  console.log(`pullzone: ${error.message}`);
}

const zones = await api("GET", "/dnszone?page=1&perPage=1000");
const zone = zones.Items.find((z) => hostname.endsWith(`.${z.Domain}`));
if (zone) {
  const recordName = hostname.slice(0, -zone.Domain.length - 1);
  const record = zone.Records.find((r) => r.Type === 2 && r.Name === recordName);
  if (record) {
    await api("DELETE", `/dnszone/${zone.Id}/records/${record.Id}`);
    console.log(`dns: removed ${hostname}`);
  } else {
    console.log(`dns: no record for ${hostname}`);
  }
}

console.log(`preview ${hostname} torn down`);
