import type { Loader } from "astro/loaders";
import type { LoaderQuery } from "~/generated/datocms";
import { z } from "astro/zod";
import query from "./loader.graphql";
import { executeQuery } from "./execute-query";
import { buildIndexMap } from "./build-index-map";
import { resolvePath, type RoutablePage } from "./resolve-path";

type EntryData = (
  | LoaderQuery["allPages"][number]
  | LoaderQuery["allPosts"][number]
  | LoaderQuery["allProjects"][number]
) & {
  locale: string;
  path: string;
  translations: Array<{ locale: string; path: string }>;
};

export function loader() {
  return {
    name: "datocms-loader",
    load: async ({ store, parseData, config }) => {
      if (!config.i18n) return;

      const { locales, defaultLocale } = config.i18n;

      store.clear();

      const entriesPerLocale = await Promise.all(
        locales.map(async (locale) => {
          const { allRoutes, allPages, allPosts, allProjects } =
            (await executeQuery(query, {
              locale,
              fallbackLocales: [defaultLocale],
            })) as LoaderQuery;

          const pageById = new Map<string, RoutablePage>(
            allPages.map((p) => [p.id, p])
          );
          const indexByCollection = buildIndexMap(allRoutes);

          const prefixCache = new Map<string, string>();
          const prefixFor = (page: RoutablePage): string => {
            let prefix = prefixCache.get(page.id);
            if (prefix === undefined) {
              prefix = resolvePath(page, pageById);
              prefixCache.set(page.id, prefix);
            }
            return prefix;
          };

          // Full locale-prefixed URL — the single source of truth for routing,
          // translation links and hreflang. `resolvePath` returns "/" for the
          // home page, which collapses to just the locale segment.
          const toUrl = (path: string) => `/${locale}${path === "/" ? "" : path}`;

          const entries = [];

          for (const page of allPages) {
            if (page.slug == null) continue;
            entries.push({
              id: `${locale}/${page.id}`,
              data: { ...page, locale, path: toUrl(prefixFor(page)) },
            });
          }

          for (const record of [...allPosts, ...allProjects]) {
            if (record.slug == null) continue;
            const indexPageId = indexByCollection.get(record._modelApiKey);
            const indexPage = indexPageId
              ? pageById.get(indexPageId)
              : undefined;
            if (!indexPage) {
              throw new Error(
                `Geen indexpagina voor collectie "${record._modelApiKey}"`
              );
            }
            entries.push({
              id: `${locale}/${record.id}`,
              data: {
                ...record,
                locale,
                path: toUrl(`${prefixFor(indexPage)}/${record.slug}`),
              },
            });
          }

          return entries;
        })
      );

      const entries = entriesPerLocale.flat();

      // A DatoCMS record shares one id across locales, so group by `data.id` to
      // collect every locale's path — the translation links for that page.
      const translationsById = new Map();
      for (const { data } of entries) {
        const list = translationsById.get(data.id) ?? [];
        list.push({ locale: data.locale, path: data.path });
        translationsById.set(data.id, list);
      }

      for (const { id, data } of entries) {
        const translations = translationsById.get(data.id);
        store.set({
          id,
          data: await parseData({
            id,
            data: { ...data, translations },
          }),
        });
      }
    },
    schema: z.custom<EntryData>(),
  } satisfies Loader;
}
