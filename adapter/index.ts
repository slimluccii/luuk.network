import type { AstroIntegration } from "astro";

export default function createIntegration(): AstroIntegration {
  return {
    name: "@slimluccii/astro-scaleway-adapter",
    hooks: {
      "astro:config:setup": ({ updateConfig, config }) => {
        updateConfig({
          build: {
            client: new URL(`./static/`, config.outDir),
            server: new URL(config.outDir),
            serverEntry: "handler.mjs",
            redirects: false
          }
        });
      },
      "astro:config:done": ({ setAdapter }) => {
        setAdapter({
          name: "@slimluccii/astro-scaleway-adapter",
          serverEntrypoint: "./adapter/handler.ts",
          exports: ["handle"],
          supportedAstroFeatures: {
            staticOutput: "stable",
            hybridOutput: "stable",
            serverOutput: "stable",
            envGetSecret: "stable",
            sharpImageService: "stable",
          },
          adapterFeatures: {
            edgeMiddleware: false,
          },
        });
      },
      // "astro:build:setup": ({ vite }) => {
      //   vite.ssr ||= {};
      //   vite.ssr.noExternal = true;
      // }
    },
  };
}
