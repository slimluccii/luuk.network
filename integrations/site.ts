import type { AstroIntegration } from "astro";
import { executeQuery } from "@datocms/cda-client";
import { loadEnv } from "vite";

const { DATOCMS_TOKEN } = loadEnv(
  process.env.NODE_ENV ?? "development",
  process.cwd(),
  ""
);

const query = `query Site { _site { locales } }`;

export default function site(): AstroIntegration {
  return {
    name: "site",
    hooks: {
      "astro:config:setup": async ({ updateConfig, logger }) => {
        const { _site } = await executeQuery<{ _site: { locales: string[] } }>(
          query,
          { token: DATOCMS_TOKEN }
        );

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

        logger.info("Configured i18n");
      },
    },
  };
}
