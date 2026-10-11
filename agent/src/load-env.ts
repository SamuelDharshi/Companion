import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import dotenv from "dotenv";

/**
 * Loads the one root `.env`, from wherever this service was started.
 *
 * A single file for the whole workspace is deliberate: four services each with their own
 * `.env` is how a demo ends up with the relayer pointing at one deployment and the agent
 * at another. Real environment variables always win, so a hosted deploy needs no file.
 */
export function loadRootEnv(): void {
  let dir = process.cwd();
  for (let i = 0; i < 6; i++) {
    const candidate = join(dir, ".env");
    if (existsSync(candidate)) {
      dotenv.config({ path: candidate, quiet: true });
      return;
    }
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  // No file is fine: the process may be configured entirely through real env vars.
}
