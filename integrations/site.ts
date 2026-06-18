import type { AstroIntegration } from "astro";
import { executeQuery } from "@datocms/cda-client";
import { loadEnv } from "vite";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const { DATOCMS_TOKEN } = loadEnv(
  process.env.NODE_ENV ?? "development",
  process.cwd(),
  ""
);

const query = `query Site {
  _site {
    locales
    faviconMetaTags {
      tag
      attributes
      content
    }
  }
}`;

type MetaTag = {
  tag: string;
  attributes: Record<string, string> | null;
  content: string | null;
};

type SiteResult = {
  _site: {
    locales: string[];
    faviconMetaTags: MetaTag[];
  };
};

export default function site(): AstroIntegration {
  return {
    name: "site",
    hooks: {
      "astro:config:setup": async ({ config, updateConfig, logger }) => {
        const { _site } = await executeQuery<SiteResult>(query, {
          token: DATOCMS_TOKEN,
        });

        // Set i18n here (not from a generated file imported by astro.config),
        // so a clean checkout without `.generated/` can still boot.
        updateConfig({
          i18n: {
            defaultLocale: _site.locales[0],
            locales: _site.locales,
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
          join(outputDir, "favicon.json"),
          JSON.stringify(_site.faviconMetaTags, null, 2)
        );

        logger.info("Generated");
      },
    },
  };
}
