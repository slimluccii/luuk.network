// @ts-check
import { defineConfig } from "astro/config";

import cloudflare from "@astrojs/cloudflare";
import mdx from "@astrojs/mdx";
import sitemap from "@astrojs/sitemap";
import designTokens from "./integrations/design-tokens";
import iconSprite from "./integrations/icon-sprite";

// https://astro.build/config
export default defineConfig({
  site: "https://luuk.network",
  adapter: cloudflare({
    imageService: "compile",
  }),
  prefetch: {
    prefetchAll: true,
  },
  integrations: [
    designTokens(),
    iconSprite(),
    mdx(),
    sitemap(),
  ],
  devToolbar: {
    enabled: false,
  },
});
