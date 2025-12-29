import { join, dirname, extname } from "node:path";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const MIME_TYPES: Record<string, string> = {
  ".html": "text/html",
  ".css": "text/css",
  ".js": "application/javascript",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".txt": "text/plain",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".otf": "font/otf",
};

export async function getStaticAsset(request: Request) {
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const url = new URL(request.url);

  const extension = extname(url.pathname);
  const hasExtension = extension !== "";

  let staticPath;
  let contentType = "text/html";

  if (hasExtension) {
    staticPath = join(__dirname, "..", "static", url.pathname);
    contentType =
      MIME_TYPES[extension.toLowerCase()] || "application/octet-stream";
  } else {
    staticPath = join(__dirname, "..", "static", url.pathname, "index.html");
  }

  if (existsSync(staticPath)) {
    const isBinary = [
      ".png",
      ".jpg",
      ".jpeg",
      ".gif",
      ".ico",
      ".woff",
      ".woff2",
      ".ttf",
      ".otf",
    ].includes(extension.toLowerCase());

    const content = isBinary
      ? await readFile(staticPath)
      : await readFile(staticPath, "utf-8");

    return { content, contentType, isBinary };
  }

  return null;
}
