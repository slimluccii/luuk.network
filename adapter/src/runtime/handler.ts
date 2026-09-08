import { createApp } from "astro/app/entrypoint";
import { setGetEnv } from "astro/env/setup";

// Snapshot at evaluation: the router removes __oesterEnv right after, and another bundle may follow in this isolate.
const env: Record<string, string> = {
  ...(globalThis as { __oesterEnv?: Record<string, string> }).__oesterEnv,
};
setGetEnv((key) => env[key]);

const app = createApp();

export default async function handler(request: Request): Promise<Response> {
  const clientAddress = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const routeData = app.match(request);
  const response = await app.render(request, {
    addCookieHeader: true,
    ...(routeData ? { routeData } : {}),
    ...(clientAddress ? { clientAddress } : {}),
  });
  return response;
}
