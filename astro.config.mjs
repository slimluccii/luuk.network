// @ts-check
import { defineConfig, envField } from "astro/config";

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
  integrations: [designTokens(), iconSprite(), sitemap()],
  devToolbar: {
    enabled: false,
  },
  security: {
    csp: {
      directives: [
        "default-src 'self'",
        "img-src 'self' data:",
        "font-src 'self'",
        "connect-src 'self'",
        "base-uri 'self'",
        "form-action 'self'",
        "object-src 'none'",
      ],
      scriptDirective: {
        resources: ["'self'", "'unsafe-inline'"],
      },
      styleDirective: {
        resources: ["'self'", "'unsafe-inline'"],
      },
    },
  },
  env: {
    schema: {
      PAGESPEED_API_KEY: envField.string({
        context: "server",
        access: "public"
      }),
    },
  }
});
