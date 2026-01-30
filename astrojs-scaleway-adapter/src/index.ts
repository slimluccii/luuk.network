import type { AstroIntegration } from "astro";

export default function createIntegration(): AstroIntegration {
  return {
    name: "@voorhoede/astro-scaleway-adapter",
    hooks: {
      "astro:config:setup": ({ updateConfig, config }) => {
        updateConfig({
          build: {
            client: new URL(`./client/`, config.outDir),
            server: new URL(`./function/`, config.outDir),
            serverEntry: "handler.mjs",
            redirects: false,
          },
        });
      },
      "astro:config:done": ({ setAdapter }) => {
        setAdapter({
          name: "@voorhoede/astrojs-scaleway-adapter",
          serverEntrypoint: "@voorhoede/astrojs-scaleway-adapter/handler.js",
          exports: ["handle"],
          supportedAstroFeatures: {
            staticOutput: "experimental",
            hybridOutput: "experimental",
            serverOutput: "experimental",
            i18nDomains: "experimental",
            envGetSecret: "experimental",
            sharpImageService: "experimental"
          },
          adapterFeatures: {
            edgeMiddleware: false,
          },
        });
      },
      "astro:build:setup": ({ vite }) => {
        vite.ssr ||= {};
        vite.ssr.noExternal = true;
      },
    },
  };
}
