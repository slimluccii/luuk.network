# Spike: model B op Bunny Edge Scripting

Eén router-script per site, server-bundles per deployment in de storage zone,
dynamisch geladen op basis van hostname. Dit document beschrijft wat er op deze
branch gebouwd is, hoe je de spike draait en waar de meetresultaten landen.

## Wat er ligt

| Onderdeel | Bestand | Wat het doet |
| --- | --- | --- |
| Adapter handler-mode | `adapter/src/runtime/handler.ts` | Nieuwe mode: de bundle exporteert een `(request) => Promise<Response>` handler in plaats van zelf een server te starten, en de build schrijft `dist/manifest.json` met de SSR-routes. De 1MB-guard staat alleen in deze mode uit (de bundle gaat naar storage; het routerscript zelf valt wel onder de cap). |
| Router-script | `router/router.ts` | Middleware op de spike pull zone. Resolvet hostname -> deploymentId via `/routing/<hostname>.json` (storage API, in-memory TTL 10s), rewrite't statics naar `/deployments/<id>/client/...`, importeert de server-bundle dynamisch voor SSR-routes. Zet `x-deployment` en `x-timing` (resolve/import/render). |
| Provisioning | `scripts/provision-spike.mjs` | Maakt eenmalig het routerscript, de spike pull zone (origin = bestaande storage zone) en de testhostnames aan, en zet de env-vars op het script. |
| Router-deploy | `scripts/deploy-router.mjs` | Bundelt de router (esbuild) en pusht + publisht hem via de API. |
| Deployment-deploy | `scripts/deploy-deployment.mjs` | Uploadt een build als onveranderlijk deployment (`/deployments/<id>/{client,server,manifest.json}`). `--pad-mb 2` maakt de bundle kunstmatig groot (H3), `--route <hostname>` wijst hem meteen toe. |
| Switch/rollback | `scripts/switch-route.mjs <hostname> <id>` | Schrijft het routing-bestand en purget de spike pull zone. Rollback is hetzelfde commando met een ouder id. |

Storage-layout in de bestaande storage zone (1 zone per project):

```
/deployments/<id>/client/...      statische output
/deployments/<id>/server/entry.mjs
/deployments/<id>/manifest.json   SSR-routes uit de adapter
/routing/<hostname>.json          { "deploymentId": "...", "updatedAt": "..." }
```

De router blokkeert `/routing/` en `/_sessions/` publiek. `/deployments/` is
publiek bereikbaar (was nodig voor de URL-importstrategie); met eval als
definitieve strategie kan dat pad in de echte versie dicht.

## De belangrijkste bevinding: import() is dood, eval leeft

Bunny's isolate weigert elke dynamische `import()`, ongeacht het schema:
https-, blob- en data-URL's falen allemaal met "failed to resolve module"
(gemeten 2026-08-26, zie `router/probe.ts` om het opnieuw te draaien). Maar
`new Function` en `eval` werken gewoon. Model B draait daarom niet op ESM-
imports maar op evaluatie: de adapter bouwt handler-bundles als iife met
globalName `__astroHandler`, de router fetcht de code via de storage API
(privé, geen purge of publieke exposure nodig) en evalueert hem eenmalig per
isolate met `new Function`. De router-cache (Map op deploymentId) vervangt de
V8-modulecache; het effect is hetzelfde.

`IMPORT_STRATEGY` kent daarom vier standen: `eval` (default, werkt),
en `url`/`blob`/`data` die de negatieve meting documenteren en
reproduceerbaar houden. `STATIC_STRATEGY=rewrite` (default) bleek op het
echte netwerk gewoon te werken: een teruggegeven Request met herschreven pad
gaat native naar de origin, met edge-caching (cdn-cache HIT op statics).

Tweede netwerkles: de middleware ziet de origin-request, niet de
client-request. De URL-host is `storage.bunnycdn.com:9000`; de echte hostname
zit in de `cdn-host` header en het protocol in `x-forwarded-proto`. De router
reconstrueert de client-URL voordat hij resolvet of rendert.

## Draaiboek

Eenmalig, met `BUNNY_API_KEY`, `BUNNY_STORAGE_ZONE` en
`BUNNY_STORAGE_PASSWORD` in de omgeving:

```
node scripts/provision-spike.mjs          # print SPIKE_SCRIPT_ID en SPIKE_PULL_ZONE_ID
export SPIKE_SCRIPT_ID=... SPIKE_PULL_ZONE_ID=...
node scripts/deploy-router.mjs
```

Per deployment:

```
npm run build
node scripts/deploy-deployment.mjs --route spike-a.luuk.network
```

De hostnames `spike-a/spike-b.luuk.network` hebben geen DNS-record; test via de
b-cdn-hostname of met `curl --connect-to spike-a.luuk.network:443:<pullzone>.b-cdn.net:443 -k`.

Testscenario's en meetgrenzen: zie het spike-document (sectie 7 en 8). TTFB
meten met `curl -w "%{time_starttransfer}"`, de rest komt uit `x-timing`.

## Lokale verificatie (gedaan, 2026-08-26)

Router onder Deno met een lokale nepstorage, beide strategie-paren:

- SSR `/` rendert via de dynamisch geïmporteerde handler (302 naar `/en/`,
  `no-store`), statics en `_astro`-assets serveren correct.
- Warm request: `import=0.0` in `x-timing`; de per-isolate modulecache werkt
  (lokale indicatie voor H2, geen uitkomst).
- Switch van routing-bestand pakt binnen de TTL van 10s de nieuwe bundle op.
- `/routing/` geeft 404, blob-import werkt zonder import-permissies,
  fetch-statics serveert de deployment-eigen `404.html`.

## Uitkomsten (live op Bunny, 2026-08-26, PoP DE, client NL)

| # | Uitkomst | Meting | Notities |
| --- | --- | --- | --- |
| H1 | NEE voor `import(url)`, JA voor laden via storage-fetch + `new Function` | Eerste SSR-request: TTFB 224ms, `resolve=70.5;import=39.1;render=9.7` | https/blob/data-imports allemaal "failed to resolve module"; eval-strategie werkt |
| H2 | JA | Warm request: `import=0.0`, TTFB ~60-76ms (= de vloer) | Cache is per isolate; per edge-server betaalt de eerste request eenmalig resolve+import (3 servers gezien op DE1) |
| H3 | JA | 2372KB bundle: `import=61-65` koud, `0.0` warm | 1MB-cap geldt alleen voor het geüploade script; padding moet script-syntax zijn (geen `export`), want eval |
| H4 | JA | 6 afwisselende requests: elk hostname consistent zijn eigen `x-deployment` | Statics per hostname gecachet; geen cross-contaminatie gezien |
| H5 | JA | Switch 0.69s, rollback 0.75s (routing-write + volledige purge) | Worst case is `ROUTING_TTL_MS` (10s) voor een isolate met verse cache; ruim onder de 15s-grens |
| H6 | JA | Na 30 min stilte: SSR TTFB 290ms (119ms daarvan TLS), `resolve=71.3;import=41.7;render=7.3`; 2.4MB-bundle 162ms; static 121ms | Isolate was geëvict (resolve+import liepen opnieuw), dus dit is een echte cold start; ruim onder de 500ms-grens |

Referentiemetingen:

- Vloer (scenario 1, leeg script): eerste request 189ms, warm 61-65ms TTFB.
  TLS-handshake is ~60-68ms daarvan (aparte curl per request); servertijd op
  de edge is enkele ms.
- `resolve` (routing + manifest via storage API, Falkenstein) kost koud
  27-118ms; dat is de prijs van privé routing-lookups vanaf de PoP.

Overige bevindingen:

- De publish-API geeft een kale 415 zonder `content-type: application/json`.
- 404 op onbekende paden serveert de `404.html` van het eigen deployment;
  `/routing/` en `/_sessions/` zijn geblokkeerd (404).
- `/deployments/` is publiek bereikbaar via de spike-hostnames; dat was nodig
  voor de url-importstrategie. Met eval als definitieve strategie kan dit
  pad client-side dicht. Er zitten geen secrets in de bundle (DATOCMS_TOKEN
  komt uit env, gecheckt).
- Productie (luuk.network) is onaangeraakt; het pad-schema botst nergens.

## Beslissing (sectie 10 van het spike-document)

H1 slaagt in de geest (dynamisch laden werkt, alleen via eval in plaats van
import), H2 en H4 slagen hard, en H6 blijft met ~120ms serverkosten bij een
echte cold start ruim onder de 500ms-previewgrens en zelfs onder de
300ms-grens uit sectie 8. Model B kan daarmee voor previews én production;
de eenmalige resolve+import per isolate (~110ms) is de enige meerprijs boven
de vloer van Bunny zelf.
