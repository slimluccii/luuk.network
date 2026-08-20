import type { AstroIntegration } from "astro";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { bundleServer } from "./bundle.ts";
import { createServerAliases } from "./node-compat.ts";
import type { InternalOptions, Options } from "./types.ts";
import { createConfigPlugin } from "./vite-plugin-config.ts";

export default function createIntegration(args?: Options): AstroIntegration {
  const internalOptions: InternalOptions = {
    ...args,
    relativeClientPath: "",
    assetsDir: "",
  };
  let serverDir: string;
  let serverEntry: string;
  return {
    name: "astro-adapter-bunny",
    hooks: {
      "astro:config:setup": ({ updateConfig, config }) => {
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
          supportedAstroFeatures: {
            hybridOutput: "stable",
            staticOutput: "stable",
            serverOutput: "stable",
            envGetSecret: "stable",
            sharpImageService: {
              support: "limited",
              message:
                "Sharp is not available on the Bunny Edge Scripting runtime. Use passthroughImageService or prerender image-heavy pages.",
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
      "astro:build:done": async ({ logger }) => {
        if (internalOptions.bundle === false) return;
        await bundleServer(serverDir, serverEntry, logger);
      },
    },
  };
}
