import type {
  PageFragment,
  PagesQuery,
  PagesQueryVariables,
  SiteLocale
} from "@generated/datocms";
import type { Loader, LoaderContext } from "astro/loaders";
import { z } from "astro:content";
import { executeQuery } from "@datocms/execute-query";
import query from "@datocms/pages.query.graphql";
import { locales } from "@generated/datocms.json";

export function pagesLoader(): Loader {
  return {
    name: "posts",
    load: async ({ store, parseData }: LoaderContext): Promise<void> => {
      store.clear();

      const results = await Promise.all(
        (locales as SiteLocale[]).map((locale) =>
          executeQuery<PagesQuery, PagesQueryVariables>(query, { locale })
        )
      );

      const allPages = results.flatMap((result, index) => {
        const locale = locales[index];
        return result.allPages.map((page) => ({
          ...page,
          _locale: locale
        }));
      });

      allPages.forEach(async (page) => {
        const id = `${page._locale}/${page.slug}`;
        const parsedPage = await parseData({
          id,
          data: page
        });
        store.set({ id, data: parsedPage });
      });
    },
    schema: z.custom<PageFragment>()
  };
}
