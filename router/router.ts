// Model B spike: one router script per site. Resolves the deployment for the
// request hostname from /routing/<hostname>.json in the storage zone, serves
// static assets from /deployments/<id>/client/ and SSR routes by dynamically
// importing /deployments/<id>/server/entry.mjs (default export = handler).
//
// Env vars on the edge script:
//   STORAGE_ZONE      storage zone name
//   STORAGE_PASSWORD  storage zone password (secret)
//   STORAGE_ENDPOINT  default https://storage.bunnycdn.com
//   PUBLIC_BASE       public URL of this pull zone, for bundle imports
//                     (e.g. https://luuk-network-spike.b-cdn.net)
//   IMPORT_STRATEGY   "url" (default) imports the bundle straight from
//                     PUBLIC_BASE; "blob" fetches it through the storage API
//                     and imports a blob: URL (fallback if the runtime blocks
//                     remote imports; also keeps bundles private)
//   STATIC_STRATEGY   "rewrite" (default) rewrites the origin request path so
//                     the pull zone fetches from storage natively; "fetch"
//                     fetches through the storage API and serves the body
//   ROUTING_TTL_MS    in-memory TTL of the hostname->deployment mapping,
//                     default 10000
//   LOCAL_ORIGIN      local emulation only: URL where the fake storage zone
//                     root is served

import * as BunnySDK from "@bunny.net/edgescript-sdk";
import { lookup } from "mrmime";

type Handler = (request: Request) => Promise<Response>;

function env(key: string): string | undefined {
  try {
    return Deno.env.get(key);
  } catch {
    return undefined;
  }
}

const storageZone = env("STORAGE_ZONE") ?? "";
const storagePassword = env("STORAGE_PASSWORD") ?? "";
const storageEndpoint = env("STORAGE_ENDPOINT") ??
  "https://storage.bunnycdn.com";
const publicBase = env("PUBLIC_BASE") ?? "";
const importStrategy = env("IMPORT_STRATEGY") ?? "eval";
const staticStrategy = env("STATIC_STRATEGY") ?? "rewrite";
const routingTtlMs = Number(env("ROUTING_TTL_MS") ?? "10000");

function storageFetch(path: string): Promise<Response> {
  return fetch(`${storageEndpoint}/${storageZone}/${path}`, {
    headers: { AccessKey: storagePassword },
  });
}

const routingCache = new Map<string, { id: string; expires: number }>();
const manifestCache = new Map<string, Promise<RegExp[]>>();
const bundleCache = new Map<string, Promise<Handler>>();

async function resolveDeployment(host: string): Promise<string | undefined> {
  const hit = routingCache.get(host);
  if (hit && hit.expires > Date.now()) return hit.id;
  const response = await storageFetch(`routing/${host}.json`);
  if (!response.ok) return undefined;
  const { deploymentId } = await response.json();
  routingCache.set(host, {
    id: deploymentId,
    expires: Date.now() + routingTtlMs,
  });
  return deploymentId;
}

function ssrRoutes(id: string): Promise<RegExp[]> {
  let promise = manifestCache.get(id);
  if (!promise) {
    promise = storageFetch(`deployments/${id}/manifest.json`).then(
      async (response) => {
        if (!response.ok) {
          throw new Error(`manifest for ${id}: ${response.status}`);
        }
        const manifest: { ssrRoutes: { regex: string }[] } = await response
          .json();
        return manifest.ssrRoutes.map((route) => new RegExp(route.regex));
      },
    );
    promise.catch(() => manifestCache.delete(id));
    manifestCache.set(id, promise);
  }
  return promise;
}

function loadBundle(id: string): Promise<Handler> {
  let promise = bundleCache.get(id);
  if (!promise) {
    promise = importBundle(id).then((mod) => mod.default);
    promise.catch(() => bundleCache.delete(id));
    bundleCache.set(id, promise);
  }
  return promise;
}

async function importBundle(id: string): Promise<{ default: Handler }> {
  const path = `deployments/${id}/server/entry.mjs`;
  // Bunny's runtime refuses dynamic import() of every specifier kind
  // (https, blob and data URLs; measured 2026-08-26), but new Function
  // works, so the default strategy evaluates an iife bundle. The import
  // strategies stay for re-running that measurement.
  if (importStrategy === "url") {
    return await import(`${publicBase}/${path}`);
  }
  const response = await storageFetch(path);
  if (!response.ok) throw new Error(`bundle for ${id}: ${response.status}`);
  if (importStrategy === "eval") {
    const code = await response.text();
    return new Function(`${code}\nreturn __astroHandler;`)();
  }
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (importStrategy === "data") {
    let binary = "";
    for (let i = 0; i < bytes.length; i += 0x8000) {
      binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    }
    return await import(`data:text/javascript;base64,${btoa(binary)}`);
  }
  const blob = new Blob([bytes], { type: "text/javascript" });
  return await import(URL.createObjectURL(blob));
}

function clientPath(id: string, pathname: string): string {
  let path = pathname;
  if (path.endsWith("/")) path += "index.html";
  else if (!/\.[^/]+$/.test(path)) path += "/index.html";
  return `deployments/${id}/client${path}`;
}

function immutableAsset(pathname: string): boolean {
  return pathname.includes("/_astro/");
}

async function serveFromStorage(
  path: string,
  status = 200,
): Promise<Response> {
  const response = await storageFetch(path);
  if (!response.ok) {
    return new Response("not found", {
      status: 404,
      headers: { "cache-control": "no-store" },
    });
  }
  const headers = new Headers();
  headers.set("content-type", lookup(path) ?? "application/octet-stream");
  if (immutableAsset(path)) {
    headers.set("cache-control", "public, max-age=31536000, immutable");
  }
  return new Response(response.body, { status, headers });
}

// On the network the middleware sees the origin request: the URL host is the
// storage zone, and the client hostname only survives in the cdn-host header.
// Locally the SDK emulation passes the client URL through unchanged.
function clientUrl(request: Request): URL {
  const url = new URL(request.url);
  const host = request.headers.get("cdn-host");
  if (host) {
    url.protocol = `${request.headers.get("x-forwarded-proto") ?? "https"}:`;
    url.host = host;
  }
  return url;
}

async function route(request: Request): Promise<Request | Response> {
  const url = clientUrl(request);
  const pathname = url.pathname;
  // The storage zone doubles as the pull zone origin; routing files and
  // session data must never be publicly reachable through it.
  if (pathname.startsWith("/routing/") || pathname.startsWith("/_sessions/")) {
    return new Response("not found", {
      status: 404,
      headers: { "cache-control": "no-store" },
    });
  }
  // Bundle imports via PUBLIC_BASE come back through this pull zone; pass
  // them straight to the origin.
  if (pathname.startsWith("/deployments/")) return request;

  const t0 = performance.now();
  const id = await resolveDeployment(url.hostname);
  if (!id) {
    return new Response(`no deployment routed for ${url.hostname}`, {
      status: 404,
      headers: { "cache-control": "no-store" },
    });
  }
  const routes = await ssrRoutes(id);
  const t1 = performance.now();

  if (!routes.some((regex) => regex.test(pathname))) {
    if (staticStrategy === "fetch") {
      return await serveFromStorage(clientPath(id, pathname));
    }
    const rewritten = new URL(request.url);
    rewritten.pathname = `/${clientPath(id, pathname)}`;
    return new Request(rewritten, request);
  }

  const handler = await loadBundle(id);
  const t2 = performance.now();
  const response = await handler(new Request(url, request));
  const t3 = performance.now();
  response.headers.set("x-deployment", id);
  response.headers.set(
    "x-timing",
    `resolve=${(t1 - t0).toFixed(1)};import=${(t2 - t1).toFixed(1)};render=${
      (t3 - t2).toFixed(1)
    }`,
  );
  return response;
}

const localOrigin = env("LOCAL_ORIGIN");
const pullZone = localOrigin
  ? BunnySDK.net.http.servePullZone(
    { port: 8085, hostname: "0.0.0.0" },
    { url: localOrigin },
  )
  : BunnySDK.net.http.servePullZone();

pullZone
  .onOriginRequest(async ({ request }) => {
    try {
      return await route(request);
    } catch (error) {
      return new Response(`router error: ${(error as Error)?.message}`, {
        status: 502,
        headers: { "cache-control": "no-store" },
      });
    }
  })
  .onOriginResponse(async ({ request, response }) => {
    const url = clientUrl(request);
    const routed = routingCache.get(url.hostname);
    if (response.status === 404 && routed) {
      return await serveFromStorage(
        `deployments/${routed.id}/client/404.html`,
        404,
      );
    }
    const extra = new Headers();
    if (response.ok && immutableAsset(url.pathname)) {
      extra.set("cache-control", "public, max-age=31536000, immutable");
    }
    if (routed) extra.set("x-deployment", routed.id);
    if ([...extra].length === 0) return response;
    const patched = new Response(response.body, response);
    extra.forEach((value, key) => patched.headers.set(key, value));
    return patched;
  });
