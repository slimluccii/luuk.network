import type { AstroIntegration } from "astro";
import StyleDictionary from "style-dictionary";
import colorOklch from "./transformers/color-oklch";
import fluidSize from "./transformers/fluid-size";

export default function designTokens(): AstroIntegration {
  return {
    name: "design-tokens",
    hooks: {
      "astro:config:setup": async ({ logger }) => {
        const sb = new StyleDictionary(
          {
            source: ["src/tokens.json", "src/tokens/**/*.json"],
            platforms: {
              css: {
                // Explicit pipeline: the default `css` group's `size/rem`
                // would choke on `{ min, max }` objects and `color/css` would
                // undo our oklch, so list only what we want.
                transforms: [
                  "attribute/cti",
                  "name/kebab",
                  "size/fluid-size",
                  "color/oklch",
                ],
                buildPath: ".generated",
                files: [
                  {
                    destination: "tokens.css",
                    format: "css/variables",
                    // fluid-scale tokens are scale definitions, not output vars.
                    filter: (token) => token.$type !== "fluid-scale",
                  },
                ],
              },
            },
          },
          {
            verbosity: "silent",
          }
        );

        // Tokens are parsed once initialized; read the fluid config before
        // building so the transforms can be configured with it.
        await sb.hasInitialized;

        sb.registerTransform(colorOklch);
        sb.registerTransform(fluidSize);

        await sb.buildAllPlatforms();
        logger.info("Generated");
      },
    },
  };
}
