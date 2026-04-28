export type NavLink = {
  href: string;
  label: string;
};

export const navLinks: NavLink[] = [
  { href: "/", label: "Home" },
  { href: "/blog/", label: "Blog" },
  { href: "/projects/", label: "Projects" },
];

export type CurrentState = "page" | "section" | undefined;

export function getCurrentState(pathname: string, href: string): CurrentState {
  if (href === "/") return pathname === "/" ? "page" : undefined;
  if (pathname === href) return "page";
  if (pathname.startsWith(href)) return "section";
  return undefined;
}

export function ariaCurrent(state: CurrentState): "page" | "true" | undefined {
  if (state === "page") return "page";
  if (state === "section") return "true";
  return undefined;
}
