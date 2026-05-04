import type { CollectionEntry } from "astro:content";

type Project = CollectionEntry<"projects">;

export function toCarouselItem(project: Project) {
  return {
    href: `/projects/${project.id}/`,
    title: project.data.title,
    description: project.data.description,
    cover: project.data.cover,
  };
}

export function toEntryListItem(project: Project) {
  return {
    href: `/projects/${project.id}/`,
    title: project.data.title,
    description: project.data.description,
    meta: project.data.stack.join(", "),
  };
}
