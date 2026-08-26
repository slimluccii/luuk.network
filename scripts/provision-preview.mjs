// Make a preview hostname live on the spike pull zone: CNAME record in the
// Bunny DNS zone, hostname on the pull zone, free SSL certificate. Idempotent,
// so safe to run on every PR push.
//
// Usage: node provision-preview.mjs <hostname>
// Env: BUNNY_API_KEY, SPIKE_PULL_ZONE_ID

import { exit } from "node:process";

const hostname = process.argv[2];
if (!hostname) {
  console.error("Usage: node provision-preview.mjs <hostname>");
  exit(1);
}
const apiKey = process.env.BUNNY_API_KEY;
const pullZoneId = process.env.SPIKE_PULL_ZONE_ID;
if (!apiKey || !pullZoneId) {
  console.error("Missing BUNNY_API_KEY or SPIKE_PULL_ZONE_ID");
  exit(1);
}

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

const pullZone = await api("GET", `/pullzone/${pullZoneId}`);
const systemHostname = pullZone.Hostnames.find((h) => h.IsSystemHostname).Value;

const zones = await api("GET", "/dnszone?page=1&perPage=1000");
const zone = zones.Items.find((z) => hostname.endsWith(`.${z.Domain}`));
if (!zone) {
  console.error(`No Bunny DNS zone found for ${hostname}`);
  exit(1);
}
const recordName = hostname.slice(0, -zone.Domain.length - 1);

const existingRecord = zone.Records.find(
  (r) => r.Type === 2 && r.Name === recordName,
);
if (existingRecord) {
  console.log(`dns: ${hostname} already -> ${existingRecord.Value}`);
} else {
  await api("PUT", `/dnszone/${zone.Id}/records`, {
    Type: 2,
    Name: recordName,
    Value: systemHostname,
    Ttl: 300,
  });
  console.log(`dns: ${hostname} CNAME ${systemHostname}`);
}

if (pullZone.Hostnames.some((h) => h.Value === hostname)) {
  console.log(`pullzone: ${hostname} already attached`);
} else {
  await api("POST", `/pullzone/${pullZoneId}/addHostname`, {
    Hostname: hostname,
  });
  console.log(`pullzone: attached ${hostname}`);
}

const hasCertificate = pullZone.Hostnames.find((h) => h.Value === hostname)
  ?.HasCertificate;
if (hasCertificate) {
  console.log(`ssl: ${hostname} already has a certificate`);
} else {
  // Issuance validates over DNS; retry while the new record propagates.
  for (let attempt = 1; ; attempt++) {
    try {
      await api(
        "GET",
        `/pullzone/loadFreeCertificate?hostname=${encodeURIComponent(hostname)}`,
      );
      console.log(`ssl: certificate loaded for ${hostname}`);
      break;
    } catch (error) {
      if (attempt >= 8) throw error;
      console.log(`ssl: not ready yet (attempt ${attempt}), retrying...`);
      await new Promise((resolve) => setTimeout(resolve, 10_000));
    }
  }
}

console.log(`preview hostname live: https://${hostname}`);
