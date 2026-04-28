// @ts-check
import { defineConfig, envField } from "astro/config";

import cloudflare from "@astrojs/cloudflare";
import mdx from "@astrojs/mdx";
import sitemap from "@astrojs/sitemap";
import beasties from "astro-beasties";
import designTokens from "./integrations/design-tokens";
import iconSprite from "./integrations/icon-sprite";

// https://astro.build/config
export default defineConfig({
  site: "https://luuk.network",
  adapter: cloudflare({
    imageService: "compile",
  }),
  integrations: [
    designTokens(),
    iconSprite(),
    mdx(),
    sitemap(),
    beasties({
      preload: "swap",
      inlineFonts: true,
    }),
  ],
  devToolbar: {
    enabled: false,
  }
});
