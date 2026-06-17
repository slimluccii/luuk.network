import { defineCollection } from "astro:content";
import { loader } from "./datocms/loader";

const pages = defineCollection({
  loader: loader()
});

export const collections = { pages };
