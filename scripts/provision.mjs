// Provision a complete Bunny setup for an Astro site in middleware mode:
// storage zone (origin) + pull zone + middleware edge script, then store
// the resulting credentials as GitHub repository secrets via `gh`.
//
// Usage: BUNNY_API_KEY=... node provision.mjs <name>
//          [--region DE|NY|LA|SG] [--tier edge|standard]
//          [--replication NY,LA,...] [--no-secrets] [--dry-run]

import { execFileSync } from "node:child_process";
import { exit } from "node:process";

const args = process.argv.slice(2);
let region = "DE";
let tier = "edge";
let replication = [];
let setSecrets = true;
let dryRun = false;
let name;
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--region") region = args[++i]?.toUpperCase();
  else if (args[i] === "--tier") tier = args[++i];
  else if (args[i] === "--replication") {
    replication = (args[++i] ?? "").split(",").map((r) => r.toUpperCase());
  } else if (args[i] === "--no-secrets") setSecrets = false;
  else if (args[i] === "--dry-run") dryRun = true;
  else name = args[i];
}
if (!name || !/^[a-z0-9-]+$/.test(name)) {
  console.error(
    "Usage: BUNNY_API_KEY=... node provision.mjs <name> [--region DE] [--tier edge|standard] [--replication NY,LA] [--no-secrets] [--dry-run]\n" +
      "Name must be lowercase alphanumeric with dashes.",
  );
  exit(1);
}
const apiKey = process.env.BUNNY_API_KEY;
if (!apiKey && !dryRun) {
  console.error("Missing required env var BUNNY_API_KEY");
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
  return response.status === 204 ? {} : await response.json();
}

const storageZone = await api("POST", "/storagezone", {
  Name: `${name}-static`,
  Region: region,
  ZoneTier: tier === "edge" ? 1 : 0,
  ...(replication.length ? { ReplicationRegions: replication } : {}),
});

const script = await api("POST", "/compute/script", {
  Name: `${name}-ssr`,
  ScriptType: 2,
  Code: 'console.log("astro-adapter-bunny: waiting for first deploy");',
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

const secrets = {
  BUNNY_STORAGE_ZONE: storageZone.Name,
  BUNNY_STORAGE_PASSWORD: storageZone.Password,
  BUNNY_STORAGE_ENDPOINT: `https://${storageZone.StorageHostname}`,
  BUNNY_SCRIPT_ID: String(script.Id),
  BUNNY_DEPLOY_KEY: script.DeploymentKey,
  BUNNY_PULL_ZONE_ID: String(pullZone.Id),
};

if (setSecrets && !dryRun) {
  for (const [key, value] of Object.entries(secrets)) {
    execFileSync("gh", ["secret", "set", key, "--body", value], {
      stdio: ["ignore", "inherit", "inherit"],
    });
  }
} else if (!dryRun) {
  console.log("\nSet these repository secrets yourself:");
  for (const [key, value] of Object.entries(secrets)) {
    console.log(`  ${key}=${value}`);
  }
}

console.log(`
Provisioned:
  storage zone  ${storageZone.Name} (id ${storageZone.Id}, ${storageZone.StorageHostname})
  edge script   ${script.Name} (id ${script.Id}, middleware)
  pull zone     ${pullZone.Name} (id ${pullZone.Id})

Site URL: https://${name}.b-cdn.net
${setSecrets && !dryRun ? "GitHub secrets updated (BUNNY_API_KEY unchanged)." : "GitHub secrets not written."}
Run the Deploy workflow (or push to main) to publish the site.`);
