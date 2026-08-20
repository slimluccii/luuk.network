# astro-adapter-bunny

Vendored Astro 7 adapter for Bunny Edge Scripting. This folder is the single
source of the adapter (the standalone repo was retired; see HISTORY.txt for
its commit log, README.md for user-facing docs). The site consumes it as a
`file:./adapter` dependency; the package exports map keeps the public
specifiers (`astro-adapter-bunny/server.ts` etc.) stable, so files can move
as long as `package.json` exports follow.

## Architecture

- `src/index.ts`: the Astro integration. Thin; delegates to `src/build/`.
- `src/build/`: runs at build time on Node. Bundling (esbuild), node-builtin
  aliases, the virtual config module, image service selection.
- `src/runtime/`: runs on Bunny's sandboxed Deno runtime. Server entry,
  session driver, Optimizer image service, static file serving.
- Adapter options travel to the runtime via the virtual module
  `virtual:astro-adapter-bunny:config`, baked in at build time. Per-route
  static headers travel via an esbuild banner instead
  (`globalThis.__ASTRO_ADAPTER_BUNNY_STATIC_HEADERS__`) because they only
  exist after the server build; both mechanisms require the bundling step.

## Hard platform constraints (learned the expensive way)

- **1MB script cap, and Bunny does not enforce it at deploy time.** An
  oversized script uploads fine, CI stays green, and then every request
  through the pull zone returns a bare 400: full outage, no fallback to the
  previous release. The build guard in `src/build/bundle.ts` exists to make
  this impossible; never remove it or the minification.
- **Native modules crash the runtime at boot with the same all-400 symptom.**
  Sharp (Astro's default image service) did this via `node:child_process`.
  The adapter swaps sharp out unless configured otherwise; the `imageService`
  modes ("passthrough" | "bunny" | "compile" | "custom") exist for this.
  In "compile" mode sharp stays external in the bundle (lazy import, never
  executed at runtime) because prerendering runs from the same server build,
  so it cannot be vite-aliased away without breaking build-time optimization.
- **Diagnosis recipe for all-400s:** run the bundle locally with
  `deno run --no-prompt --no-remote --allow-net --allow-env dist/server/entry.mjs`
  (no fs access, like Bunny) and read the stack trace. Trace which dependency
  drags in a node builtin with an esbuild metafile: build with
  `bundle: false` in the adapter options, then
  `npx esbuild dist/server/entry.mjs --bundle --format=esm --platform=node --conditions=deno --metafile=...`.
  Note: the runtime DOES allow env access (`Deno.env`), so a local
  NotCapable env error is not proof of a live crash.
- **Pull zone settings make or break SSR.** Dashboard-created zones strip
  `Set-Cookie` from responses and force a 30-day cache that ignores origin
  cache-control. Required: DisableCookies=false,
  CacheControlMaxAgeOverride=-1 (respect origin), IgnoreQueryStrings=false.
  `scripts/provision.mjs` sets these; manually created zones break silently
  without them (frozen SSR HTML, broken cookie/session flows).
- **Rendered responses default to `cache-control: no-store`** (set in
  `runtime/server.ts`) because the CDN caches anything without cache-control.
  Routes opt in to edge caching by setting their own cache-control header.
- **Sessions live in the storage zone that doubles as the public origin.**
  The `/_sessions/` path block in `runtime/server.ts` is a security control,
  not dead code: without it session data is readable through the CDN.
- **The script type on Bunny must match the `mode` option.** A middleware
  bundle deployed to a standalone-type script silently never runs (requests
  fall through to the origin); the type is fixed at script creation.
- **The SDK's local pull zone emulation loses origin status codes**, so
  origin-404 handling (custom 404.html, Astro 404 fallback) can only be
  verified on the real network. The 404.html fetch in middleware mode goes
  through the pull zone itself; the pathname check that stops the recursion
  is load-bearing.
- **`staticOrigin` means two things**: on Bunny in standalone mode it is the
  asset fallback origin; in middleware mode it is only the local emulation
  origin and is ignored in production.

## Verification

- Build the site, then run the bundle locally:
  `deno run --no-remote --allow-net --allow-read --allow-env dist/server/entry.mjs`
  (`--no-remote` proves the bundle is self-contained). For middleware mode,
  serve `dist/client` separately (`python3 -m http.server 8095`) and point
  `staticOrigin` at it.
- After adapter changes, audit the bundle's remaining imports:
  `grep -oE 'from"node:[a-z_/]+"' dist/server/entry.mjs` — only
  Deno-polyfilled builtins are acceptable, `child_process` is fatal.
- The full-feature test bench (sessions, islands, env, cookies, streaming,
  API routes) lived in the retired repo's example app; this site only
  exercises static output plus one SSR redirect route. Feature-level adapter
  changes need a fresh scratch project to verify against.

## Deploy pipeline

`.github/workflows/deploy.yml`: build, sync `dist/client` to the storage
zone (`scripts/deploy-storage.mjs`, SHA256-diffed), deploy the script with
the official BunnyWay action (script-scoped deploy key), purge the pull
zone. Secrets are documented in README.md. Known race: the purge fires
seconds after the script deploy while the release still propagates; harmless
now that SSR responses are no-store, relevant again if that ever changes.
`scripts/provision.mjs` creates a complete new site (storage + pull zone +
middleware script, correct settings) and stores the GitHub secrets.

## Open roadmap

Per-PR preview deployments: provision/destroy per PR via the Bunny API
(provision.mjs is the reusable core; a destroy counterpart is missing),
statics under a `--dest previews/pr-<nr>` prefix (flag already exists in
deploy-storage.mjs), URL as PR comment, cleanup on close. Evaluate the
official Bunny CLI (https://bunny.net/docs/cli) as an alternative to the
raw API calls.
