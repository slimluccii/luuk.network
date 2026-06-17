import type { AstroIntegration } from "astro";
import { loadEnv } from "vite";
import { executeQueryWithAutoPagination } from "@datocms/cda-client";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import query from "./translations.query.graphql?raw";
import type {
  SiteLocale,
  TranslationsQuery,
  TranslationsQueryVariables,
} from "~/generated/datocms";

const { DATOCMS_CDA_TOKEN } = loadEnv(process.env.NODE_ENV!, process.cwd(), "");

export default function translations(): AstroIntegration {
  return {
    name: "translations",
    hooks: {
      "astro:config:setup": async ({ config, logger }) => {
        if (!config.i18n) return;

        const byLocale: Record<string, Record<string, string>> = {};

        for (const locale of config.i18n.locales) {
          const code = typeof locale === "string" ? locale : locale.path;

          const { allTranslations } = await executeQueryWithAutoPagination<
            TranslationsQuery,
            TranslationsQueryVariables
          >(query, {
            token: DATOCMS_CDA_TOKEN,
            variables: { locale: code as SiteLocale },
          });

          byLocale[code] = Object.fromEntries(
            allTranslations
              .filter((translation) => translation.key != null)
              .map((translation) => [translation.key, translation.value ?? ""])
          );
        }

        const outputDir = join(config.root.pathname, ".generated");

        await mkdir(outputDir, { recursive: true });
        await writeFile(
          join(outputDir, "translations.json"),
          JSON.stringify(byLocale, null, 2)
        );

        logger.info("Generated");
      },
    },
  };
}
