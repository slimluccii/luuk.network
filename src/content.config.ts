import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { z } from "astro/zod";

const projects = defineCollection({
  loader: glob({ base: "./src/content/projects", pattern: "**/*.mdx" }),
  schema: ({ image }) =>
    z.object({
      title: z.string(),
      description: z.string(),
      stack: z.array(z.string()),
      href: z.string().url().optional(),
      year: z.string(),
      featured: z.boolean().default(false),
      order: z.number().default(0),
      subject: z.union([image(), z.string()]).default(""),
      cover: z.union([image(), z.string()]).default(""),
    }),
});

export const collections = { projects };
