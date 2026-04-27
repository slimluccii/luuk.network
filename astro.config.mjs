// @ts-check
import { defineConfig } from "astro/config";

import cloudflare from "@astrojs/cloudflare";
import sitemap from "@astrojs/sitemap";
import designTokens from "./integrations/design-tokens";
import iconSprite from "./integrations/icon-sprite";

// https://astro.build/config
export default defineConfig({
  site: "https://luuk.network",
  adapter: cloudflare({
    imageService: "compile",
  }),
  build: {
    inlineStylesheets: "always",
  },
  integrations: [designTokens(), iconSprite(), sitemap()],
  devToolbar: {
    enabled: false,
  },
});
