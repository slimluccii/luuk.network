import { extname } from "node:path";
import mime from "mime-types";

interface ProxyResponse {
  statusCode: number;
  headers: Record<string, string>;
  body: string;
  isBase64Encoded?: boolean;
}

export async function serveStaticAsset(
  rawPath: string,
  storageBaseUrl: string,
): Promise<ProxyResponse> {
  let path = rawPath.split("?")[0].split("#")[0];
  if (!extname(path)) {
    path = path.endsWith("/") ? `${path}index.html` : `${path}/index.html`;
  }

  const url = new URL(path, storageBaseUrl);
  const upstream = await fetch(url);

  if (upstream.status === 404) {
    return { statusCode: 404, headers: {}, body: "Not Found" };
  }

  const contentType =
    mime.lookup(path) ||
    upstream.headers.get("content-type") ||
    "application/octet-stream";

  const headers: Record<string, string> = { "Content-Type": contentType };
  const cacheControl = upstream.headers.get("cache-control");
  if (cacheControl) headers["Cache-Control"] = cacheControl;

  const isText =
    mime.charset(contentType) ||
    contentType.includes("text/") ||
    contentType.includes("json") ||
    contentType.includes("xml") ||
    contentType.includes("javascript");

  if (!isText) {
    const buf = Buffer.from(await upstream.arrayBuffer());
    return {
      statusCode: upstream.status,
      headers,
      isBase64Encoded: true,
      body: buf.toString("base64"),
    };
  }

  return {
    statusCode: upstream.status,
    headers,
    body: await upstream.text(),
  };
}
