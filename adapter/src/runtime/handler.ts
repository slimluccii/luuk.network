import { createApp } from "astro/app/entrypoint";
import { setGetEnv } from "astro/env/setup";

setGetEnv((key) => {
  try {
    return Deno.env.get(key);
  } catch {
    return undefined;
  }
});

const app = createApp();

export default async function handler(request: Request): Promise<Response> {
  const clientAddress =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? undefined;
  const response = await app.render(request, {
    routeData: app.match(request) ?? undefined,
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
