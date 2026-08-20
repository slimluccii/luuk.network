export interface Options {
  /**
   * How the script is attached to its pull zone. "standalone" serves every
   * request itself; "middleware" hooks into a pull zone whose origin is a
   * storage zone with dist/client, rendering only SSR routes and letting
   * assets pass through to the origin. Must match the script type configured
   * on Bunny. Default: "standalone".
   */
  mode?: "standalone" | "middleware";
  /** Port for the local dev server. Ignored on the Bunny runtime. */
  port?: number;
  /** Hostname for the local dev server. Ignored on the Bunny runtime. */
  hostname?: string;
  /**
   * Absolute URL where dist/client is served. In standalone mode on Bunny
   * it is the asset fallback origin; in middleware mode it is only used
   * locally, to emulate the pull zone origin.
   */
  staticOrigin?: string;
  /** Bundle the server into a single deployable edge script. Default: true. */
  bundle?: boolean;
  /**
   * Which image service to configure:
   * - "passthrough" (default): originals are served untouched. A non-sharp
   *   `image.service` you configured yourself is left alone.
   * - "bunny": images are transformed through Bunny Optimizer URL parameters
   *   (requires the Optimizer add-on with the Dynamic Image API enabled on
   *   the pull zone). `astro dev` uses sharp so images work locally.
   * - "compile": sharp optimizes images at build time for prerendered pages
   *   only; on-demand rendered pages serve originals.
   * - "custom": the adapter never touches the image configuration.
   */
  imageService?: "passthrough" | "bunny" | "compile" | "custom";
}

export interface InternalOptions extends Options {
  relativeClientPath: string;
  assetsDir: string;
}
