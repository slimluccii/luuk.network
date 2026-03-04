import { pagesLoader } from "@datocms/pages-loader";
import type { PageFragment } from "@generated/datocms";
import { defineCollection, z } from "astro:content";

const pages = defineCollection({
  loader: pagesLoader(),
  schema: z.custom<PageFragment>()
});

export const collections = { pages };
