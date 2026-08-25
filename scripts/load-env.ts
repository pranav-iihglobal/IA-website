import { loadEnvConfig } from "@next/env";

/**
 * Load environment variables exactly the way `next dev` does.
 *
 * Uses Next's own loader rather than reading a single hard-coded file, so
 * .env, .env.local and .env.development are all picked up — a script must
 * never disagree with the app about which variables exist.
 */
export function loadEnv(): string[] {
  const { loadedEnvFiles } = loadEnvConfig(process.cwd(), true, {
    info: () => {},
    error: () => {},
  });
  return loadedEnvFiles.map((file) => file.path);
}
