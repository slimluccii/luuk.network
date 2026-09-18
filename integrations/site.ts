import type { AstroIntegration } from "astro";
import { buildClient } from "@datocms/cma-client";
import { loadEnv } from "vite";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const { DATOCMS_TOKEN } = loadEnv(
  process.env.NODE_ENV ?? "development",
  process.cwd(),
  ""
);

const client = buildClient({ apiToken: DATOCMS_TOKEN });

export default function site(): AstroIntegration {
  return {
    name: "site",
    hooks: {
      "astro:config:setup": async ({ config, updateConfig, logger }) => {
        const site = await client.site.find();

        updateConfig({
          i18n: {
            defaultLocale: site.locales[0],
            locales: site.locales,
            // Astro's own i18n middleware is off, so src/middleware.ts is the
            // only thing that decides which locale a visitor gets.
            routing: "manual",
          },
        });

        const outputDir = join(config.root.pathname, ".generated");

        await mkdir(outputDir, { recursive: true });
        await writeFile(
          join(outputDir, "site.json"),
          JSON.stringify(site, null, 2)
        );

        logger.info("Generated");
      },
    },
  };
}
