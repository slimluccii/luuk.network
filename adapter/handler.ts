import type { Handler } from "@scaleway/serverless-functions/framework/dist/framework/types/types";
import type { SSRManifest } from "astro";
import { App } from "astro/app";
import { eventToRequest } from "./utils/event-to-request";
import { getStaticAsset } from "./utils/serveStaticAsset";

export function createExports(manifest: SSRManifest) {
  const app = new App(manifest);

  const handle: Handler = async (event) => {
    const request = eventToRequest(event);

    const routeData = app.match(request);
    if (!routeData) {
      const asset = await getStaticAsset(request);

      if (asset) {
        const headers: Record<string, string> = {
          "Content-Type": asset.contentType,
        };

        if (asset.isBinary) {
          headers["Content-Length"] = (
            asset.content as Buffer
          ).length.toString();
        } else {
          headers["Content-Length"] = Buffer.byteLength(
            asset.content as string,
            "utf8",
          ).toString();
        }

        headers["Cache-Control"] = "public, max-age=31536000"; // 1 year for static assets

        if (asset.contentType.startsWith("image/")) {
          headers["X-Content-Type-Options"] = "nosniff";
        }

        return {
          body: asset.isBinary
            ? (asset.content as Buffer).toString("base64")
            : asset.content,
          statusCode: "200",
          headers,
          isBase64Encoded: asset.isBinary,
        };
      }
    }

    const response = await app.render(request);

    return {
      body: await response.text(),
      statusCode: response.status,
      headers: Object.fromEntries(response.headers.entries()),
    };
  };

  return { handle };
}
