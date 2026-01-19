import type { Handler } from "@scaleway/serverless-functions/framework/dist/framework/types/types";
import type { SSRManifest } from "astro";
import { App } from "astro/app";
import { eventToRequest } from "./utils/event-to-request";

export function createExports(manifest: SSRManifest) {
  const app = new App(manifest);

  const handle: Handler = async (event) => {
    const request = eventToRequest(event);
    let response;

    const routeData = app.match(request);
    if (!routeData) {
      const url = new URL(event.path, 'https://luuk-network.s3.nl-ams.scw.cloud');
      response = await fetch(url);
      if (response.status !== 404) {
        return {
          body: await response.text(),
          statusCode: response.status,
          headers: Object.fromEntries(response.headers.entries()),
        };
      }
    }

    response = await app.render(request);

    return {
      body: await response.text(),
      statusCode: response.status,
      headers: Object.fromEntries(response.headers.entries()),
    };
  };

  return { handle };
}
