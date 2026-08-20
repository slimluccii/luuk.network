// Sync a local directory to a Bunny Storage Zone.
// Diffs on SHA256 checksums so unchanged files are skipped.
//
// Usage: node deploy-storage.mjs <dir> [--dest <prefix>] [--prune] [--dry-run]
// Env: BUNNY_STORAGE_ZONE, BUNNY_STORAGE_PASSWORD,
//      BUNNY_STORAGE_ENDPOINT (default https://storage.bunnycdn.com)

import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { exit } from "node:process";

const CONCURRENCY = 8;

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    console.error(`Missing required env var ${name}`);
    exit(1);
  }
  return value;
}

const args = process.argv.slice(2);
let prune = false;
let dryRun = false;
let dest = "";
let dir;
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--prune") prune = true;
  else if (args[i] === "--dry-run") dryRun = true;
  else if (args[i] === "--dest") dest = args[++i] ?? "";
  else dir = args[i];
}
if (!dir) {
  console.error(
    "Usage: node deploy-storage.mjs <dir> [--dest <prefix>] [--prune] [--dry-run]",
  );
  exit(1);
}

const zone = requireEnv("BUNNY_STORAGE_ZONE");
const password = requireEnv("BUNNY_STORAGE_PASSWORD");
const endpoint = process.env.BUNNY_STORAGE_ENDPOINT ||
  "https://storage.bunnycdn.com";
const prefix = dest ? dest.replace(/^\/|\/$/g, "") + "/" : "";

function remoteUrl(path) {
  return `${endpoint}/${zone}/${prefix}${path}`;
}

async function listRemote(path = "") {
  const response = await fetch(remoteUrl(path), {
    headers: { AccessKey: password },
  });
  if (response.status === 404) return new Map();
  if (!response.ok) {
    throw new Error(`Listing ${path || "/"} failed: ${response.status}`);
  }
  const entries = await response.json();
  const files = new Map();
  for (const entry of entries) {
    const entryPath = path + entry.ObjectName;
    if (entry.IsDirectory) {
      for (const [p, checksum] of await listRemote(entryPath + "/")) {
        files.set(p, checksum);
      }
    } else {
      files.set(entryPath, entry.Checksum);
    }
  }
  return files;
}

async function listLocal() {
  const entries = await readdir(dir, { recursive: true, withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile())
    .map((entry) =>
      join(entry.parentPath, entry.name)
        .slice(dir.length)
        .replace(/^\//, "")
        .replaceAll("\\", "/")
    );
}

async function inPool(items, worker) {
  const queue = [...items];
  await Promise.all(
    Array.from({ length: CONCURRENCY }, async () => {
      let item;
      while ((item = queue.shift()) !== undefined) {
        await worker(item);
      }
    }),
  );
}

const [remote, local] = await Promise.all([listRemote(), listLocal()]);
let uploaded = 0;
let skipped = 0;
let deleted = 0;

await inPool(local, async (path) => {
  const body = await readFile(join(dir, path));
  const checksum = createHash("sha256").update(body).digest("hex")
    .toUpperCase();
  if (remote.get(path) === checksum) {
    skipped++;
    return;
  }
  if (!dryRun) {
    const response = await fetch(remoteUrl(path), {
      method: "PUT",
      headers: { AccessKey: password, Checksum: checksum },
      body,
    });
    if (!response.ok) {
      throw new Error(`Upload ${path} failed: ${response.status}`);
    }
  }
  console.log(`upload ${path}`);
  uploaded++;
});

if (prune) {
  const localSet = new Set(local);
  const stale = [...remote.keys()].filter((path) => !localSet.has(path));
  await inPool(stale, async (path) => {
    if (!dryRun) {
      const response = await fetch(remoteUrl(path), {
        method: "DELETE",
        headers: { AccessKey: password },
      });
      if (!response.ok) {
        throw new Error(`Delete ${path} failed: ${response.status}`);
      }
    }
    console.log(`delete ${path}`);
    deleted++;
  });
}

console.log(
  `${dryRun ? "[dry-run] " : ""}${uploaded} uploaded, ${skipped} unchanged, ${deleted} deleted`,
);
