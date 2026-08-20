const staticHeaders = (globalThis as {
  __ASTRO_ADAPTER_BUNNY_STATIC_HEADERS__?: Record<
    string,
    Record<string, string>
  >;
}).__ASTRO_ADAPTER_BUNNY_STATIC_HEADERS__ ?? {};

/** Per-route headers Astro emitted for prerendered pages (e.g. CSP). */
export function staticHeadersFor(
  pathname: string,
): Record<string, string> | undefined {
  const key =
    pathname.replace(/\/index\.html$/, "").replace(/\.html$/, "").replace(
      /\/$/,
      "",
    ) || "/";
  return staticHeaders[key] ?? staticHeaders[key + "/"];
}

export function withHeaders(response: Response, extra: Headers): Response {
  if ([...extra].length === 0) return response;
  const patched = new Response(response.body, response);
  extra.forEach((value, key) => patched.headers.set(key, value));
  return patched;
}
