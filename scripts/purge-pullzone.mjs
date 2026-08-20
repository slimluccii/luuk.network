// Purge the full cache of a Bunny Pull Zone.
// Env: BUNNY_API_KEY, BUNNY_PULL_ZONE_ID

const apiKey = process.env.BUNNY_API_KEY;
const pullZoneId = process.env.BUNNY_PULL_ZONE_ID;
if (!apiKey || !pullZoneId) {
  console.error("Missing BUNNY_API_KEY or BUNNY_PULL_ZONE_ID");
  process.exit(1);
}

const endpoint = process.env.BUNNY_API_ENDPOINT ?? "https://api.bunny.net";
const response = await fetch(`${endpoint}/pullzone/${pullZoneId}/purgeCache`, {
  method: "POST",
  headers: { AccessKey: apiKey },
});
if (!response.ok) {
  console.error(`Purge failed: ${response.status}`);
  process.exit(1);
}
console.log(`Purged pull zone ${pullZoneId}`);
