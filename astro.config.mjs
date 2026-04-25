// @ts-check
import { defineConfig } from 'astro/config';

import cloudflare from '@astrojs/cloudflare';
import designTokens from './integrations/design-tokens';

// https://astro.build/config
export default defineConfig({
  adapter: cloudflare(),
  integrations: [
    designTokens()
  ]
});