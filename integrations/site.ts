import type { AstroIntegration } from "astro";
import { buildClient } from "@datocms/cma-client";
import { loadEnv } from "vite";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const { DATOCMS_CMA_TOKEN } = loadEnv(
  process.env.NODE_ENV ?? "development",
  process.cwd(),
  ""
);

const client = buildClient({ apiToken: DATOCMS_CMA_TOKEN });

export default function site(): AstroIntegration {
  return {
    name: "site",
    hooks: {
      "astro:config:setup": async ({ config, updateConfig, logger }) => {
        const site = await client.site.find();

        // Set i18n here (not from a generated file imported by astro.config),
        // so a clean checkout without `.generated/` can still boot — otherwise
        // the config can't load the file the integration is meant to create.
        updateConfig({
          i18n: {
            defaultLocale: site.locales[0],
            locales: site.locales,
            routing: {
              prefixDefaultLocale: true,
              redirectToDefaultLocale: true,
              fallbackType: "redirect",
            },
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
