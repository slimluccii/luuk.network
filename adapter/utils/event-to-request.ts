import type { Event } from "@scaleway/serverless-functions/framework/dist/framework/types/types";

export function eventToRequest({
  httpMethod,
  headers,
  path,
  queryStringParameters,
  body,
  isBase64Encoded,
}: Event): Request {
  const eventHeaders: Record<string, string> = {};
  if (headers) {
    Object.entries(headers).forEach(([key, value]) => {
      eventHeaders[key] = String(value);
    });
  }

  const protocol = eventHeaders["X-Forwarded-Proto"] || "https";
  const host = eventHeaders["host"] || "localhost";
  const url = new URL(path, `${protocol}://${host}`);

  if (queryStringParameters) {
    Object.entries(queryStringParameters).forEach(([key, value]) => {
      url.searchParams.set(key, value);
    });
  }

  let requestBody: string | null = null;
  if (body) {
    if (isBase64Encoded) {
      requestBody = atob(body);
    } else {
      requestBody = body;
    }
  }

  return new Request(url, {
    method: httpMethod,
    headers: new Headers(eventHeaders),
    body: requestBody,
  });
}
