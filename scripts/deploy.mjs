#!/usr/bin/env node
/**
 * Deploys the contracts using the ONE root `.env`.
 *
 * `forge` reads a `.env` from the Foundry project root (`contracts/`), not the repo root,
 * so running it directly would silently miss every value and deploy with defaults. This
 * loads the root file and hands it to forge explicitly.
 */
import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const envPath = join(root, ".env");

if (!existsSync(envPath)) {
  console.error("\nNo .env file. Run:  cp .env.example .env\n");
  process.exit(1);
}

const fileEnv = Object.fromEntries(
  readFileSync(envPath, "utf8")
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    }),
);
// Real environment variables win, so CI needs no file.
const env = { ...fileEnv, ...process.env };

for (const key of ["MONAD_RPC_URL", "DEPLOYER_PRIVATE_KEY"]) {
  if (!env[key] || env[key] === "0x") {
    console.error(`\nMissing ${key} in .env — see .env.example\n`);
    process.exit(1);
  }
}

const args = [
  "script",
  "script/Deploy.s.sol:Deploy",
  "--rpc-url",
  env.MONAD_RPC_URL,
  "--broadcast",
  ...process.argv.slice(2),
];

const forge = spawn("forge", args, {
  cwd: join(root, "contracts"),
  env: { ...env, FOUNDRY_DISABLE_NIGHTLY_WARNING: "1" },
  stdio: "inherit",
  shell: true,
});
forge.on("exit", (code) => process.exit(code ?? 1));
