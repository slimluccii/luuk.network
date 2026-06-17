import type { LoaderQuery } from "~/generated/datocms";

export function buildIndexMap(
  routes: LoaderQuery["allRoutes"]
): Map<string, string> {
  const map = new Map<string, string>();
  for (const route of routes) {
    if (!route.collection || !route.indexPage) continue;
    if (map.has(route.collection)) {
      throw new Error(`Meerdere routes voor collectie "${route.collection}"`);
    }
    map.set(route.collection, route.indexPage.id);
  }
  return map;
}
