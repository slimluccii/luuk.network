export type CurrentState = "page" | "section" | undefined;

const normalize = (path: string) => path.replace(/\/+$/, "") || "/";

export function getCurrentState(pathname: string, href: string): CurrentState {
  const path = normalize(pathname);
  const target = normalize(href);
  if (path === target) return "page";
  // A locale root (e.g. `/en`) prefixes every page, so it's page-only —
  // otherwise it would mark itself active across the entire site.
  const isLocaleRoot = /^\/[^/]+$/.test(target);
  if (!isLocaleRoot && path.startsWith(`${target}/`)) return "section";
  return undefined;
}

export function ariaCurrent(state: CurrentState): "page" | "true" | undefined {
  if (state === "page") return "page";
  if (state === "section") return "true";
  return undefined;
}
