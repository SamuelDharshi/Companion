#!/usr/bin/env node
/**
 * Writes `.render.env`: exactly the values the hosted service needs, copied from your local `.env`, ready to paste
 * into Render (Environment, "Add from .env"). The file is git-ignored. Nothing is printed to the terminal except
 * the NAMES of what was written and what is missing.
 *
 *   node scripts/render-env.mjs --site https://companion-monad.vercel.app
 *
 * It deliberately leaves out DEPLOYER_PRIVATE_KEY (the service never needs it) and every EXPO_PUBLIC_ value.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const siteArg = process.argv.indexOf("--site");
const site = (siteArg > 0 ? process.argv[siteArg + 1] : "https://companion-monad.vercel.app").replace(/\/$/, "");

const envPath = join(root, ".env");
if (!existsSync(envPath)) {
  console.error("No .env file to copy from.");
  process.exit(1);
}
const local = Object.fromEntries(
  readFileSync(envPath, "utf8")
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).replace(/\s+#.*$/, "").trim()];
    }),
);

const required = [
  "MONAD_RPC_URL",
  "RELAYER_PRIVATE_KEY",
  "AGENT_PRIVATE_KEY",
  "DEV_ADMIN_TOKEN",
  "INTERNAL_TOKEN",
  "VAPID_PUBLIC_KEY",
  "VAPID_PRIVATE_KEY",
];
const optional = ["VAPID_SUBJECT", "ANTHROPIC_API_KEY", "CLASSIFIER_MODEL", "CLASSIFIER_EFFORT", "CLASSIFIER_TIMEOUT_MS", "ALCHEMY_RPC_URL", "ALCHEMY_WEBHOOK_SIGNING_KEY", "CRE_TOKEN", "ORCHESTRATOR"];
const fixed = {
  NODE_VERSION: "22",
  DATA_DIR: "/tmp/companion-data",
  LOG_LEVEL: "info",
  TESTNET_PARTNER_STANDIN: "true",
  KEEPER_ENABLED: "true",
  LOGS_RPC_URL: local.LOGS_RPC_URL || "https://testnet-rpc.monad.xyz",
  THUNAI_DEPLOYMENT: local.THUNAI_DEPLOYMENT || "agora",
  THUNAI_START_BLOCK: local.THUNAI_START_BLOCK || "70125617",
  APP_URL: `${site}/app`,
  CORS_ORIGIN: site,
};

const lines = [];
const missing = [];
for (const key of required) {
  if (!local[key] || local[key] === "0x") missing.push(key);
  else lines.push(`${key}=${local[key]}`);
}
for (const key of optional) if (local[key]) lines.push(`${key}=${local[key]}`);
for (const [key, value] of Object.entries(fixed)) lines.push(`${key}=${value}`);

writeFileSync(join(root, ".render.env"), lines.join("\n") + "\n");
console.log(`Wrote .render.env with ${lines.length} values (git-ignored). Names:`);
console.log("  " + lines.map((l) => l.split("=")[0]).join(", "));
if (missing.length) console.log(`\nMissing from your .env (the service will not start without them): ${missing.join(", ")}`);
