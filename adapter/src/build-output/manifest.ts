export type RouteType = "prerendered" | "server";

export interface Route {
  pattern: string;
  type: RouteType;
  file?: string;
  regex?: string;
}

export interface Redirect {
  from: string;
  to: string;
  status: 301 | 302 | 307 | 308;
}

export interface HeaderRule {
  path: string;
  headers: Record<string, string>;
}

export type Routing = "server-first" | "static-first";

export interface Manifest {
  version: 1;
  framework: string;
  routing?: Routing;
  routes: Route[];
  redirects: Redirect[];
  headers: HeaderRule[];
  server?: { entry: string };
  fallback?: string;
}

export type Validation = { ok: true; manifest: Manifest } | { ok: false; errors: string[] };

const REDIRECT_STATUSES = new Set([301, 302, 307, 308]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isPath(value: unknown): value is string {
  return typeof value === "string" && value.startsWith("/");
}

function isRelativeFile(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    !value.startsWith("/") &&
    !value.split("/").includes("..")
  );
}

function compiles(regex: string): boolean {
  try {
    new RegExp(regex);
    return true;
  } catch {
    return false;
  }
}

export function validateManifest(json: unknown): Validation {
  if (!isRecord(json)) return { ok: false, errors: ["manifest must be an object"] };
  const errors: string[] = [];

  if (json.version !== 1) errors.push("version must be 1");
  if (typeof json.framework !== "string" || json.framework === "") {
    errors.push("framework must be a non-empty string");
  }

  const routes: Route[] = [];
  if (!Array.isArray(json.routes)) {
    errors.push("routes must be an array");
  } else {
    json.routes.forEach((route: unknown, i) => {
      const at = `routes[${i}]`;
      if (!isRecord(route)) {
        errors.push(`${at} must be an object`);
        return;
      }
      if (!isPath(route.pattern)) errors.push(`${at}.pattern must be a string starting with /`);
      if (route.type !== "prerendered" && route.type !== "server") {
        errors.push(`${at}.type must be prerendered or server`);
        return;
      }
      if (route.type === "prerendered") {
        if (route.file === undefined) errors.push(`${at}.file is required on a prerendered route`);
        else if (!isRelativeFile(route.file)) {
          errors.push(`${at}.file must be a relative path without .. segments`);
        }
      } else if (route.regex === undefined) {
        errors.push(`${at}.regex is required on a server route`);
      } else if (typeof route.regex !== "string" || !compiles(route.regex)) {
        errors.push(`${at}.regex is not a valid regular expression`);
      }
      routes.push(route as unknown as Route);
    });
  }

  const redirects: Redirect[] = [];
  if (json.redirects !== undefined) {
    if (!Array.isArray(json.redirects)) {
      errors.push("redirects must be an array");
    } else {
      json.redirects.forEach((redirect: unknown, i) => {
        const at = `redirects[${i}]`;
        if (!isRecord(redirect)) {
          errors.push(`${at} must be an object`);
          return;
        }
        if (!isPath(redirect.from)) errors.push(`${at}.from must be a string starting with /`);
        if (typeof redirect.to !== "string" || redirect.to === "") {
          errors.push(`${at}.to must be a non-empty string`);
        }
        if (typeof redirect.status !== "number" || !REDIRECT_STATUSES.has(redirect.status)) {
          errors.push(`${at}.status must be 301, 302, 307 or 308`);
        }
        redirects.push(redirect as unknown as Redirect);
      });
    }
  }

  const headers: HeaderRule[] = [];
  if (json.headers !== undefined) {
    if (!Array.isArray(json.headers)) {
      errors.push("headers must be an array");
    } else {
      json.headers.forEach((rule: unknown, i) => {
        const at = `headers[${i}]`;
        if (!isRecord(rule)) {
          errors.push(`${at} must be an object`);
          return;
        }
        if (!isPath(rule.path)) errors.push(`${at}.path must be a string starting with /`);
        if (!isRecord(rule.headers)) {
          errors.push(`${at}.headers must be an object`);
        } else if (Object.values(rule.headers).some((value) => typeof value !== "string")) {
          errors.push(`${at}.headers values must be strings`);
        }
        headers.push(rule as unknown as HeaderRule);
      });
    }
  }

  let routing: Routing | undefined;
  if (json.routing !== undefined) {
    if (json.routing !== "server-first" && json.routing !== "static-first") {
      errors.push("routing must be server-first or static-first");
    } else {
      routing = json.routing;
    }
  }

  let fallback: string | undefined;
  if (json.fallback !== undefined) {
    if (!isRelativeFile(json.fallback))
      errors.push("fallback must be a relative path without .. segments");
    else fallback = json.fallback;
  }

  const needsServer = routes.some((route) => route.type === "server");
  let server: Manifest["server"];
  if (json.server === undefined) {
    if (needsServer) errors.push("server.entry is required because a route has type server");
  } else if (!isRecord(json.server) || !isRelativeFile(json.server.entry)) {
    errors.push("server.entry must be a relative path without .. segments");
  } else if (!needsServer) {
    errors.push("server.entry is set but no route has type server");
  } else {
    server = { entry: json.server.entry };
  }

  if (errors.length > 0) return { ok: false, errors };
  return {
    ok: true,
    manifest: {
      version: 1,
      framework: json.framework as string,
      ...(routing ? { routing } : {}),
      routes,
      redirects,
      headers,
      ...(server ? { server } : {}),
      ...(fallback ? { fallback } : {}),
    },
  };
}

export type Match =
  | { kind: "server"; route: Route }
  | { kind: "prerendered"; file: string }
  | { kind: "static"; file: string }
  | { kind: "static-then-server"; file: string; route: Route };

function staticFile(pathname: string): string {
  const file = pathname.endsWith("/") ? `${pathname}index.html` : pathname;
  return file.replace(/^\/+/, "");
}

export function matchRoute(manifest: Manifest, pathname: string): Match {
  const staticFirst = manifest.routing === "static-first";
  if (staticFirst) {
    for (const route of manifest.routes) {
      if (route.type === "prerendered" && route.pattern === pathname && route.file) {
        return { kind: "prerendered", file: route.file };
      }
    }
  }
  for (const route of manifest.routes) {
    if (route.type === "server" && route.regex && new RegExp(route.regex).test(pathname)) {
      return staticFirst
        ? { kind: "static-then-server", file: staticFile(pathname), route }
        : { kind: "server", route };
    }
  }
  for (const route of manifest.routes) {
    if (route.type === "prerendered" && route.pattern === pathname && route.file) {
      return { kind: "prerendered", file: route.file };
    }
  }
  return { kind: "static", file: staticFile(pathname) };
}
