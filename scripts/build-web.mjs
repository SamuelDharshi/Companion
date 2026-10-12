#!/usr/bin/env node
/**
 * Builds ONE website: the landing page with the Companion app inside it at /app.
 *
 * It exports the Expo app as a static web build into `frontend/public/app`, configured to live under /app
 * and to reach the relayer and agent through the same origin (/relayer and /agent, which the landing
 * site proxies). Then, with --next, it builds the landing site too.
 *
 *   pnpm web:build            export the app into frontend/public/app
 *   pnpm web:build -- --next  ...and run `next build`, as a hosting service would
 *   pnpm web:dev              export the app, then start the landing site on http://localhost:3000
 *
 * The result is a single origin, so a passkey is tied to one permanent host, there is no CORS, and no
 * mixed content between the app and its servers.
 */
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const appDir = join(root, "app");
const frontend = join(root, "frontend");
const outDir = join(frontend, "public", "app");

const wantNext = process.argv.includes("--next");
const wantDev = process.argv.includes("--dev");

function dotenv() {
  try {
    return Object.fromEntries(
      readFileSync(join(root, ".env"), "utf8")
        .split("\n")
        .map((l) => l.trim())
        .filter((l) => l && !l.startsWith("#") && l.includes("="))
        .map((l) => {
          const i = l.indexOf("=");
          return [l.slice(0, i).trim(), l.slice(i + 1).replace(/\s+#.*$/, "").trim()];
        }),
    );
  } catch {
    return {};
  }
}
const fileEnv = dotenv();

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { stdio: "inherit", shell: true, ...options });
  if (result.status !== 0) {
    console.error(`\n\`${command} ${args.join(" ")}\` failed (exit ${result.status}).`);
    process.exit(result.status ?? 1);
  }
}

// 1. Export the app, mounted at /app, talking to same-origin /relayer and /agent.
console.log("\n[1/2] Exporting the Companion app to frontend/public/app ...\n");
if (existsSync(outDir)) rmSync(outDir, { recursive: true, force: true });
// --clear: Expo inlines EXPO_PUBLIC_ values at build time, and a cached build keeps the old ones (an indexer address
// added to .env would otherwise never reach the bundle).
run("pnpm", ["exec", "expo", "export", "--platform", "web", "--clear", "--output-dir", JSON.stringify(outDir)], {
  cwd: appDir,
  env: {
    ...process.env,
    EXPO_BASE_URL: "/app",
    EXPO_PUBLIC_BASE_PATH: "/app",
    EXPO_PUBLIC_RELAYER_URL: "/relayer",
    EXPO_PUBLIC_AGENT_URL: "/agent",
    // An indexer address is public by nature, so it is passed through if one is set.
    ...(fileEnv.EXPO_PUBLIC_INDEXER_URL ? { EXPO_PUBLIC_INDEXER_URL: fileEnv.EXPO_PUBLIC_INDEXER_URL } : {}),
  },
});

const html = existsSync(join(outDir, "index.html")) ? readFileSync(join(outDir, "index.html"), "utf8") : "";
if (!html.includes("/app/_expo/")) {
  console.error("\nThe export did not come out mounted at /app (no /app/_expo/ asset paths in index.html).");
  process.exit(1);
}
console.log("\nThe app is exported and mounted at /app.");

// 2. The landing site.
if (wantNext) {
  console.log("\n[2/2] Building the landing site ...\n");
  run("pnpm", ["install", "--ignore-workspace"], { cwd: frontend });
  run("pnpm", ["exec", "next", "build"], { cwd: frontend });
}
if (wantDev) {
  console.log("\nStarting the landing site on http://localhost:3000  (app at /app, press Ctrl-C to stop)\n");
  run("pnpm", ["exec", "next", "dev", "-p", "3000"], { cwd: frontend });
}
