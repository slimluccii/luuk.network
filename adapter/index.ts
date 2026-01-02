import type { AstroIntegration } from "astro";
import { defaultClientConditions } from "vite";

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
            redirects: false,
          }
        });
      },
      "astro:build:setup": ({ vite, target }) => {
        if (target === 'server') {
          // Support `workerd` and `worker` conditions for the ssr environment
          // (previously supported in esbuild instead: https://github.com/withastro/astro/pull/7092)
          vite.ssr ||= {};
          vite.ssr.resolve ||= {};
          vite.ssr.resolve.conditions ||= [...defaultClientConditions];
          vite.ssr.resolve.conditions.push('workerd', 'worker');

          vite.ssr.target = 'webworker';
          vite.ssr.noExternal = true;
          vite.ssr.external = [
            'node:path',
            'node:fs',
            'node:fs/promises',
            'node:url',
            'node:crypto',
            'node:buffer',
            'node:stream',
            'node:util',
          ];

          vite.build ||= {};
          vite.build.rollupOptions ||= {};
          vite.build.rollupOptions.output ||= {};
          // @ts-expect-error
          vite.build.rollupOptions.output.banner ||=
            'globalThis.process ??= { env: {} }; globalThis.module ??= { exports: {} };';

          // Scaleway env is only available per request. This isn't feasible for code that access env vars
          // in a global way, so we shim their access as `process.env.*`. This is not the recommended way for users to access environment variables. But we'll add this for compatibility for chosen variables.
          vite.define = {
            'process.env': 'process.env',
            ...vite.define,
          };
        }
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
      }
    },
  };
}
