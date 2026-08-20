# astro-adapter-bunny

An Astro adapter for [Bunny Edge Scripting](https://docs.bunny.net/scripting). Renders SSR routes on Bunny's Deno-based edge runtime, bundled into a single deployable script.

Clean-room implementation for Astro 7, modeled on the architecture of [@deno/astro-adapter](https://github.com/denoland/deno-astro-adapter) (MIT). No code from the AGPL `bunny-astro` package.

Status: proof of concept. SSR and API routes verified on the Bunny network (standalone script, 2026-08-20) and locally under Deno. Static asset wiring (storage zone plus pull zone) is not set up yet.

## Usage

```js
// astro.config.mjs
import { defineConfig, passthroughImageService } from "astro/config";
import bunny from "astro-adapter-bunny";

export default defineConfig({
  output: "server",
  adapter: bunny(),
  image: {
    service: passthroughImageService(),
  },
});
```

`astro build` produces the usual `dist/client`, and `dist/server` containing a single self-contained `entry.mjs` (the adapter bundles Astro's server output in place; only `node:` builtin imports remain, which the Deno-based runtime provides). That file is what you deploy to Bunny.

### Options

| Option | Default | Description |
| --- | --- | --- |
| `mode` | `standalone` | `middleware` hooks into a pull zone whose origin serves `dist/client`; `standalone` serves everything itself. Must match the script type on Bunny. |
| `port` | `8080` | Local server port. Ignored on Bunny. |
| `hostname` | `0.0.0.0` | Local server hostname. Ignored on Bunny. |
| `staticOrigin` | none | Absolute URL where `dist/client` is served. Standalone mode uses it as asset fallback on Bunny; middleware mode only uses it locally, to emulate the pull zone origin. |
| `bundle` | `true` | Set to `false` to skip the esbuild bundling step. |
| `imageService` | `passthrough` | `bunny` (Bunny Optimizer via URL parameters; sharp in dev), `compile` (sharp at build time for prerendered pages only), `custom` (never touch the image config). |

### Request handling

Middleware mode (recommended; the Cloudflare model): upload `dist/client` to a storage zone and set it as the pull zone origin. The script intercepts origin requests: SSR routes render and short-circuit the origin, everything else passes through to storage with native CDN caching. Fingerprinted `_astro/` assets get immutable cache headers; origin 404s render Astro's 404 page. Locally, set `staticOrigin` to a local server for `dist/client` (e.g. `python3 -m http.server 8095 -d dist/client`) so the SDK can emulate the pull zone. Known SDK limitation: the local emulation loses the origin response status, so the 404-to-Astro-404 path only works on Bunny itself.

Standalone mode: the script serves every request itself.

1. Request matches an SSR route: render with Astro.
2. Otherwise try a static file from `dist/client` on disk (works locally; on Bunny the filesystem is unavailable and this falls through).
3. Otherwise, if `staticOrigin` is set, proxy the asset from there.
4. Otherwise render Astro's 404.

## Astro features

- **Islands**: client islands (framework components with `client:*`) and server islands (`server:defer`) work; the example uses Preact.
- **Env schema** (`astro:env`): server and client variables plus `getSecret()` are supported. On Bunny, set the values as environment variables or secrets on the edge script; the runtime exposes them through `Deno.env`.
- **Sessions**: the adapter provides a default session driver backed by the Bunny Storage API (override it by setting `session.driver` yourself). It reads `BUNNY_STORAGE_ZONE`, `BUNNY_STORAGE_PASSWORD` and optionally `BUNNY_STORAGE_ENDPOINT` at runtime, so set those on the edge script (password as a secret). Sessions are stored under `_sessions/` in the storage zone; the server refuses to serve that path since the zone doubles as the public origin. Without credentials (local dev) sessions fall back to in-memory storage.
- **Middleware** (`src/middleware.ts`): works unchanged.
- **Images**: sharp cannot run on the edge runtime (native bindings), so the adapter swaps Astro's default image service for the noop service unless you configured one yourself. For real optimization set `imageService: "bunny"` in the adapter options and enable Bunny Optimizer with the Dynamic Image API on the pull zone (paid add-on). Images are then transformed by the CDN via URL parameters and cached per variant; without Optimizer the parameters are ignored and originals are served.
- **Static headers**: with `security.csp` (or anything else that emits per-route headers for prerendered pages), the server applies those headers when the pages are served, including storage passthrough in middleware mode. Requires the bundling step (`bundle: false` skips the injection).
- **i18n domains**: marked experimental; multiple hostnames on one pull zone should route locale domains correctly, but this is unvalidated.
- Fully static projects (no on-demand routes) keep the same `dist/client` plus `dist/server` layout, so the deploy pipeline is identical whether or not a site uses SSR.

## Pull zone settings

Dashboard-created pull zones default to stripping cookies and forcing a 30-day edge cache, which breaks SSR (stale HTML, no `Set-Cookie`). The provisioning script configures this correctly; for manually created zones set Caching > Cache Expiration Time to respect origin headers, and disable response cookie stripping.

## Local verification

```sh
cd examples/basic
pnpm build
deno run --no-remote --allow-net --allow-read --allow-env dist/server/entry.mjs
```

`--no-remote` proves the bundle is self-contained. Test SSR (`/`), API (`/api/hello`), prerendered (`/about`), static (`/robots.txt`), and 404 behavior. Match the Deno version to the one Bunny runs in production.

## Provisioning

`scripts/provision.mjs` creates everything a site needs on Bunny in one run: an (Edge tier) storage zone as origin, a pull zone, and a middleware edge script attached to it, then stores the resulting credentials as GitHub repository secrets via `gh`.

```sh
BUNNY_API_KEY=... node scripts/provision.mjs my-site
```

Flags: `--region DE|NY|LA|SG` (default DE), `--tier edge|standard` (default edge), `--replication NY,LA`, `--no-secrets` (print instead of storing), `--dry-run`. The `BUNNY_API_KEY` secret itself must be set once by hand; after provisioning, push to main (or rerun the Deploy workflow) and the site is live at `https://<name>.b-cdn.net`.

## CI/CD

Copy `scripts/` and a deploy workflow into your site's repository (see [luuk.network](https://github.com/slimluccii/luuk.network) for a live setup). The workflow deploys on push to main:

1. Build the site.
2. `scripts/deploy-storage.mjs` syncs `dist/client` to the storage zone. It diffs on SHA256 checksums so unchanged files are skipped; `--prune` deletes remote files that no longer exist locally, `--dest <prefix>` uploads under a subdirectory (intended for per-branch previews), `--dry-run` prints without writing.
3. The official `BunnyWay/actions/deploy-script` action deploys `dist/server/entry.mjs` using a script-scoped deploy key.
4. `scripts/purge-pullzone.mjs` purges the pull zone cache so updated prerendered HTML goes live.

Required repository secrets:

| Secret | Where to find it |
| --- | --- |
| `BUNNY_STORAGE_ZONE` | Storage zone name |
| `BUNNY_STORAGE_PASSWORD` | Storage zone > FTP & API Access > Password |
| `BUNNY_SCRIPT_ID` | Edge script > Deployments > Settings |
| `BUNNY_DEPLOY_KEY` | Edge script > Deployments > Settings |
| `BUNNY_API_KEY` | Account settings > API. Only used for the cache purge |
| `BUNNY_PULL_ZONE_ID` | Pull zone dashboard URL |

If the storage zone's main region is not Falkenstein, also set `BUNNY_STORAGE_ENDPOINT` (e.g. `https://ny.storage.bunnycdn.com`) as env on the sync step.

## Open items

- Wire a pull zone plus storage zone for statics and validate the full site on Bunny.
- Environment variables on Bunny: the server reads `Deno.env`, confirm how Edge Scripting exposes secrets.
- Middleware mode (`servePullZone`) as an alternative to standalone serving.
- Per-PR preview deployments (script plus pull zone per branch via the Bunny API).
