import type { Handler } from "@scaleway/serverless-functions/framework/dist/framework/types/types";
import type { SSRManifest } from "astro";
import { App } from "astro/app";
import { eventToRequest } from "./utils/event-to-request";
import { serveStaticAsset } from "./utils/serveStaticAsset";
import { serializeHeaders } from "./utils/serializeHeaders";


export function createExports(manifest: SSRManifest) {
  const app = new App(manifest);

  const handle: Handler = async (event) => {
    const { BUCKET_ENDPOINT } = process.env;

    const request = eventToRequest(event);

    const routeData = app.match(request);
    if (!routeData && BUCKET_ENDPOINT) {
      const response = await serveStaticAsset(event.path, BUCKET_ENDPOINT);

      if (response.statusCode === 200) {
        return response;
      }
    }

    const response = await app.render(request);
    return {
      body: await response.text(),
      statusCode: response.status,
      headers: serializeHeaders(response.headers),
    };
  };

  return { handle };
}
