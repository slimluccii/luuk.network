import { lookup } from "mrmime";

function contentType(path: string): string {
  const mime = lookup(path) ?? "application/octet-stream";
  return /^text\/|^application\/(json|javascript|xml)/.test(mime)
    ? `${mime}; charset=utf-8`
    : mime;
}

async function readFile(url: URL): Promise<Uint8Array | null> {
  try {
    const stat = await Deno.stat(url);
    if (!stat.isFile) return null;
    return await Deno.readFile(url);
  } catch {
    return null;
  }
}

/**
 * Serve a static file from the local client build. Succeeds only where
 * dist/client is on disk (local Deno); on the Bunny runtime every read
 * throws and resolves to null, falling through to staticOrigin.
 * Falls back to index.html / .html so prerendered pages resolve like a CDN.
 */
export async function serveLocalFile(
  pathname: string,
  clientRoot: URL,
): Promise<Response | null> {
  if (pathname.includes("..")) return null;
  const candidates = pathname.endsWith("/")
    ? [pathname + "index.html"]
    : [pathname, pathname + "/index.html", pathname + ".html"];
  for (const candidate of candidates) {
    const url = new URL("." + candidate, clientRoot);
    const body = await readFile(url);
    if (body) {
      return new Response(body as BodyInit, {
        headers: { "content-type": contentType(candidate) },
      });
    }
  }
  return null;
}
