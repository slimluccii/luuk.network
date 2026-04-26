import type { AstroIntegration } from "astro";
import SVGSpriter from "svg-sprite";
import { mkdir, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";

export default function iconSprite(): AstroIntegration {
  return {
    name: "icon-sprite",
    hooks: {
      "astro:config:setup": async ({ addWatchFile, config, logger }) => {
        const icons = import.meta.glob<string>("../src/icons/*.svg", {
          query: "?raw",
          import: "default",
          eager: true,
        });

        const spriter = new SVGSpriter({
          mode: {
            symbol: true,
          },
        });

        const names: string[] = [];
        for (const [path, contents] of Object.entries(icons)) {
          const name = basename(path, ".svg");
          names.push(name);
          spriter.add(path, `${name}.svg`, contents);
        }

        const { result } = await spriter.compileAsync();

        const outputDir = join(config.root.pathname, ".generated");

        await mkdir(outputDir, { recursive: true });
        await writeFile(
          join(outputDir, "icon-sprite.svg"),
          result.symbol.sprite.contents
        );
        await writeFile(
          join(outputDir, "icon-sprite.ts"),
          `export type IconName = ${names.map((name) => `'${name}'`).join(" | ")}`
        );

        logger.info("Generated");
      },
    },
  };
}
