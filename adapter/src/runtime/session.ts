interface SessionDriver {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
  removeItem: (key: string) => Promise<void>;
}

export interface SessionDriverOptions {
  endpoint?: string;
  zone?: string;
  password?: string;
  prefix?: string;
}

function env(key: string): string | undefined {
  try {
    return Deno.env.get(key);
  } catch {
    return undefined;
  }
}

/**
 * Session storage backed by the Bunny Storage API. Credentials are read at
 * runtime from BUNNY_STORAGE_ZONE / BUNNY_STORAGE_PASSWORD /
 * BUNNY_STORAGE_ENDPOINT (set them as env vars on the edge script) so the
 * storage password is never baked into the bundle. Without credentials
 * (local dev) sessions live in memory.
 */
export default function createBunnySessionDriver(
  options: SessionDriverOptions | undefined,
): SessionDriver {
  const endpoint = options?.endpoint ?? env("BUNNY_STORAGE_ENDPOINT") ??
    "https://storage.bunnycdn.com";
  const zone = options?.zone ?? env("BUNNY_STORAGE_ZONE");
  const password = options?.password ?? env("BUNNY_STORAGE_PASSWORD");
  const prefix = options?.prefix ?? "_sessions";

  if (!zone || !password) {
    const memory = new Map<string, string>();
    return {
      getItem: (key) => Promise.resolve(memory.get(key) ?? null),
      setItem: (key, value) => {
        memory.set(key, value);
        return Promise.resolve();
      },
      removeItem: (key) => {
        memory.delete(key);
        return Promise.resolve();
      },
    };
  }

  const url = (key: string) =>
    `${endpoint}/${zone}/${prefix}/${encodeURIComponent(key)}`;
  const headers = { AccessKey: password };
  return {
    async getItem(key) {
      const response = await fetch(url(key), { headers });
      if (response.status === 404) return null;
      if (!response.ok) {
        throw new Error(`Session read failed: ${response.status}`);
      }
      return await response.text();
    },
    async setItem(key, value) {
      const response = await fetch(url(key), {
        method: "PUT",
        headers,
        body: value,
      });
      if (!response.ok) {
        throw new Error(`Session write failed: ${response.status}`);
      }
    },
    async removeItem(key) {
      const response = await fetch(url(key), { method: "DELETE", headers });
      if (!response.ok && response.status !== 404) {
        throw new Error(`Session delete failed: ${response.status}`);
      }
    },
  };
}
