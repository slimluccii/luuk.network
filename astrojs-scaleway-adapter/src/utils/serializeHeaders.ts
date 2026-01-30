export function serializeHeaders(headers: Headers): Record<string, string> {
  const result: Record<string, string> = {};

  headers.forEach((value, key) => {
    if (key.toLowerCase() === 'content-type') {
      result['Content-Type'] = value;
    } else {
      result[key] = value;
    }
  });

  if ('getSetCookie' in headers && typeof headers.getSetCookie === 'function') {
    const cookies = headers.getSetCookie();
    if (cookies.length > 0) {
      result['Set-Cookie'] = cookies.join(', ');
    }
  }

  return result;
}
