import type { CollectionEntry } from "astro:content";
import { formatDateRange } from "~/utils/date-range";

type Project = CollectionEntry<"projects">;

export function toCarouselItem(project: Project) {
  return {
    href: `/projects/${project.id}/`,
    title: project.data.title,
    description: project.data.description,
    cover: project.data.cover,
    meta: formatDateRange(project.data.startDate, project.data.endDate),
    transitionName: `project-${project.id}`,
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
