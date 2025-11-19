import type { PageFragment, PagesQuery, PagesQueryVariables } from "@generated/datocms";
import { defineCollection, z } from "astro:content";
import { executeQuery } from "@datocms/execute-query";
import query from "@datocms/pages.query.graphql";

const pages = defineCollection({
  loader: async () => {
    const { allPages } = await executeQuery<PagesQuery, PagesQueryVariables>(query);
    return allPages;
  },
  schema: z.custom<PageFragment>()
})

export const collections = { pages };
