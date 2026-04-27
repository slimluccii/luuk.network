export type NavLink = {
  href: string;
  label: string;
};

export const navLinks: NavLink[] = [
  { href: "/", label: "Home" },
  { href: "/blog/", label: "Blog" },
  { href: "/projects/", label: "Projects" },
];
