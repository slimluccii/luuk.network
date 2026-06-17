export type RoutablePage = {
  id: string;
  slug: string | null;
  parent?: { id: string } | null;
};

export function resolvePath(
  page: RoutablePage,
  pageById: Map<string, RoutablePage>
): string {
  const segments: string[] = [];
  const seen = new Set<string>();
  let current: RoutablePage | undefined = page;
  while (current) {
    if (seen.has(current.id)) {
      throw new Error(`Cyclische parent-keten bij pagina ${current.id}`);
    }
    seen.add(current.id);
    if (current.slug) segments.unshift(current.slug);
    const parentId: string | undefined = current.parent?.id;
    current = parentId ? pageById.get(parentId) : undefined;
  }
  return "/" + segments.join("/");
}
