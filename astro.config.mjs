// @ts-check
import { defineConfig } from 'astro/config';

import cloudflare from '@astrojs/cloudflare';
import designTokens from './integrations/design-tokens';
import iconSprite from './integrations/icon-sprite';

// https://astro.build/config
export default defineConfig({
  site: 'https://luuk.network',
  adapter: cloudflare({
    imageService: "compile"
  }),
  integrations: [
    designTokens(),
    iconSprite()
  ],
  devToolbar: {
    enabled: false
  }
});