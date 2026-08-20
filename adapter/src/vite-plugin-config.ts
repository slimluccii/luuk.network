import type { AstroConfig } from "astro";
import type { InternalOptions } from "./types.ts";

export const VIRTUAL_CONFIG_ID = "virtual:astro-adapter-bunny:config";
const RESOLVED_VIRTUAL_CONFIG_ID = "\0" + VIRTUAL_CONFIG_ID;

export function createConfigPlugin(
  config: InternalOptions,
): NonNullable<AstroConfig["vite"]["plugins"]>[number] {
  return {
    name: VIRTUAL_CONFIG_ID,
    resolveId: {
      filter: {
        id: new RegExp(`^${VIRTUAL_CONFIG_ID}$`),
      },
      handler() {
        return RESOLVED_VIRTUAL_CONFIG_ID;
      },
    },
    load: {
      filter: {
        id: new RegExp(`^${RESOLVED_VIRTUAL_CONFIG_ID}$`),
      },
      handler() {
        return `export const config = ${JSON.stringify(config)};`;
      },
    },
  };
}
