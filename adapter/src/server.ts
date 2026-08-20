import { createApp } from "astro/app/entrypoint";
import { setGetEnv } from "astro/env/setup";
import * as BunnySDK from "@bunny.net/edgescript-sdk";
import { config } from "virtual:astro-adapter-bunny:config";
import { serveLocalFile } from "./static-file.ts";

setGetEnv((key) => {
  try {
    return Deno.env.get(key);
  } catch {
    return undefined;
  }
});

const app = createApp();
const clientRoot = new URL(config.relativeClientPath, import.meta.url);
const listener = {
  port: config.port ?? 8080,
  hostname: config.hostname ?? "0.0.0.0",
};

async function render(
  request: Request,
  routeData?: ReturnType<typeof app.match>,
): Promise<Response> {
  const clientAddress =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? undefined;
  const response = await app.render(request, {
    routeData: routeData ?? undefined,
    addCookieHeader: true,
    clientAddress,
  });
  // The pull zone caches anything without cache-control for 30 days;
  // rendered responses must opt in to caching, not out.
  if (!response.headers.has("cache-control")) {
    response.headers.set("cache-control", "no-store");
  }
  return response;
}

function isImmutableAsset(request: Request): boolean {
  const pathname = app.removeBase(new URL(request.url).pathname);
  return pathname.startsWith(`/${config.assetsDir}/`);
}

// Sessions live in the same storage zone the pull zone serves as origin;
// without this block they would be publicly readable through the CDN.
function isSessionPath(pathname: string): boolean {
  return pathname.startsWith("/_sessions/");
}

async function standaloneHandler(request: Request): Promise<Response> {
  const routeData = app.match(request);
  if (routeData) {
    return await render(request, routeData);
  }

  const pathname = app.removeBase(new URL(request.url).pathname);
  if (isSessionPath(pathname)) return await render(request);
  const fileResponse = await serveLocalFile(pathname, clientRoot);
  if (fileResponse) return fileResponse;

  if (config.staticOrigin) {
    try {
      const originUrl = new URL(pathname, config.staticOrigin);
      const response = await fetch(originUrl, {
        headers: request.headers,
        method: request.method === "HEAD" ? "HEAD" : "GET",
      });
      if (response.ok) return response;
    } catch {
      // An unreachable static origin degrades to a 404, not a crash.
    }
  }

  return await notFound(request);
}

// Static-output sites have a prerendered 404.html that the server manifest
// does not know about; serve it before falling back to Astro's default 404.
async function notFound(request: Request): Promise<Response> {
  const prerendered = await serveLocalFile("/404.html", clientRoot);
  if (prerendered) {
    return new Response(prerendered.body, {
      status: 404,
      headers: prerendered.headers,
    });
  }
  return await render(request);
}

if (config.mode === "middleware") {
  // The pull zone's origin (a storage zone with dist/client) serves anything
  // the middleware passes through; staticOrigin only emulates it locally.
  const pullZone = config.staticOrigin
    ? BunnySDK.net.http.servePullZone(listener, { url: config.staticOrigin })
    : BunnySDK.net.http.servePullZone();
  pullZone
    .onOriginRequest(({ request }) => {
      const routeData = app.match(request);
      if (routeData) {
        return render(request, routeData);
      }
      if (isSessionPath(app.removeBase(new URL(request.url).pathname))) {
        return render(request);
      }
      return Promise.resolve(request);
    })
    .onOriginResponse(async ({ request, response }) => {
      if (response.status === 404) {
        const url = new URL(request.url);
        // The 404.html fetch goes through this pull zone and thus through
        // this middleware again; the pathname check stops the recursion.
        if (app.removeBase(url.pathname) !== "/404.html") {
          const custom = await fetch(new URL("/404.html", url.origin));
          if (custom.ok) {
            return new Response(custom.body, {
              status: 404,
              headers: custom.headers,
            });
          }
        }
        return await render(request);
      }
      if (response.ok && isImmutableAsset(request)) {
        const cached = new Response(response.body, response);
        cached.headers.set(
          "cache-control",
          "public, max-age=31536000, immutable",
        );
        return cached;
      }
      return response;
    });
} else {
  BunnySDK.net.http.serve(listener, standaloneHandler);
}
