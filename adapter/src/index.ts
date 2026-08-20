import type { AstroIntegration } from "astro";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { bundleServer } from "./build/bundle.ts";
import { resolveImageService } from "./build/image-config.ts";
import { createServerAliases } from "./build/node-compat.ts";
import { createConfigPlugin } from "./build/vite-plugin-config.ts";
import type { InternalOptions, Options } from "./types.ts";

export default function createIntegration(args?: Options): AstroIntegration {
  const internalOptions: InternalOptions = {
    ...args,
    relativeClientPath: "",
    assetsDir: "",
  };
  let serverDir: string;
  let serverEntry: string;
  const staticHeaders: Record<string, Record<string, string>> = {};
  return {
    name: "astro-adapter-bunny",
    hooks: {
      "astro:config:setup": ({ updateConfig, config, command }) => {
        updateConfig({
          vite: {
            plugins: [createConfigPlugin(internalOptions)],
          },
        });
        if (config.session !== false && !config.session?.driver) {
          updateConfig({
            session: {
              driver: { entrypoint: "astro-adapter-bunny/session.ts" },
            },
          });
        }
        const imageService = resolveImageService(
          internalOptions.imageService,
          config,
          command,
        );
        if (imageService) {
          updateConfig({ image: { service: imageService } });
        }
      },
      "astro:config:done": ({ setAdapter, config }) => {
        const clientPath = join(fileURLToPath(config.build.client));
        const serverPath = join(fileURLToPath(config.build.server));
        internalOptions.relativeClientPath = relative(serverPath, clientPath) +
          "/";
        internalOptions.assetsDir = config.build.assets;
        serverDir = serverPath;
        serverEntry = config.build.serverEntry;
        setAdapter({
          name: "astro-adapter-bunny",
          entrypointResolution: "auto",
          serverEntrypoint: "astro-adapter-bunny/server.ts",
          adapterFeatures: {
            staticHeaders: true,
            preserveBuildClientDir: true,
            preserveBuildServerDir: true,
          },
          supportedAstroFeatures: {
            hybridOutput: "stable",
            staticOutput: "stable",
            serverOutput: "stable",
            envGetSecret: "stable",
            i18nDomains: {
              support: "experimental",
              message:
                "Multiple hostnames on one pull zone should route locale domains correctly, but this has not been validated on the Bunny network.",
            },
            sharpImageService: {
              support: "limited",
              message:
                "Sharp is not available on the Bunny Edge Scripting runtime. The adapter falls back to the noop image service; set imageService: 'bunny' for Bunny Optimizer.",
            },
          },
        });
      },
      "astro:build:setup": ({ vite, target }) => {
        if (target === "server") {
          vite.resolve = vite.resolve ?? {};
          vite.resolve.alias = vite.resolve.alias ?? {};

          const aliases = createServerAliases();
          if (Array.isArray(vite.resolve.alias)) {
            vite.resolve.alias = [...vite.resolve.alias, ...aliases];
          } else {
            for (const alias of aliases) {
              (vite.resolve.alias as Record<string, string>)[alias.find] =
                alias.replacement;
            }
          }
        }
      },
      "astro:build:generated": ({ routeToHeaders }) => {
        for (const [pathname, { headers }] of routeToHeaders) {
          const entries: Record<string, string> = {};
          headers.forEach((value, key) => {
            entries[key] = value;
          });
          if (Object.keys(entries).length > 0) {
            staticHeaders[pathname] = entries;
          }
        }
      },
      "astro:build:done": async ({ logger }) => {
        if (internalOptions.bundle === false) return;
        // In compile mode prerendering already ran with sharp; leaving the
        // lazy `import("sharp")` unresolved keeps the native module out of
        // the deployed bundle, and nothing prerendered ever executes it.
        const external = internalOptions.imageService === "compile"
          ? ["sharp"]
          : [];
        await bundleServer(
          serverDir,
          serverEntry,
          logger,
          staticHeaders,
          external,
        );
      },
    },
  };
}
