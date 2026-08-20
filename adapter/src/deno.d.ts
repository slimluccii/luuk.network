// Only the Deno surface the server uses; the package is typed against Node
// and the full Deno lib would conflict with it.
declare const Deno: {
  env: { get(key: string): string | undefined };
  stat(path: URL): Promise<{ isFile: boolean }>;
  readFile(path: URL): Promise<Uint8Array>;
};
