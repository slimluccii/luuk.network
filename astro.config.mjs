// @ts-check
import { defineConfig, envField } from "astro/config";

import cloudflare from "@astrojs/cloudflare";
import sitemap from "@astrojs/sitemap";
import graphql from "@rollup/plugin-graphql";
import site from "./integrations/site";
import translations from "./integrations/translations";
import codegen from "./integrations/codegen";
import designTokens from "./integrations/design-tokens";
import icons from "./integrations/icons";
import codegenConfig from "./codegen";

// https://astro.build/config
export default defineConfig({
  site: "https://luuk.network",
  adapter: cloudflare({
    imageService: 'passthrough'
  }),
  integrations: [
    codegen(codegenConfig),
    site(),
    translations(),
    icons(),
    designTokens(),
    sitemap(),
  ],
  security: {
    csp: true,
  },
  markdown: {
    syntaxHighlight: false,
  },
  devToolbar: {
    enabled: false,
  },
  prefetch: true,
  vite: {
    plugins: [graphql()],
  },
  env: {
    schema: {
      DATOCMS_TOKEN: envField.string({
        context: "server",
        access: "secret",
      }),
    },
  },
});
