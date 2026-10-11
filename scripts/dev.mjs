#!/usr/bin/env node
/**
 * Starts everything for a local demo: relayer, agent and the app.
 *
 * Checks the environment first and says plainly what is missing, because the worst place
 * to discover an unset key is thirty seconds into a recording. Anything optional that is
 * absent is reported as a degraded mode rather than an error, so you always know which
 * version of the demo you are about to show.
 *
 * Run: pnpm dev
 */
import { spawn, spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "node:net";
import { randomBytes } from "node:crypto";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const dim = (s) => `\x1b[90m${s}\x1b[0m`;
const green = (s) => `\x1b[32m${s}\x1b[0m`;
const yellow = (s) => `\x1b[33m${s}\x1b[0m`;
const red = (s) => `\x1b[31m${s}\x1b[0m`;
const purple = (s) => `\x1b[35m${s}\x1b[0m`;

// ---- environment ----------------------------------------------------------

const envPath = join(root, ".env");
if (!existsSync(envPath)) {
  console.error(red("\nNo .env file.\n"));
  console.error("  cp .env.example .env\n");
  console.error("Then fill in MONAD_RPC_URL and the three private keys.\n");
  process.exit(1);
}

const env = Object.fromEntries(
  readFileSync(envPath, "utf8")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#") && line.includes("="))
    .map((line) => {
      const index = line.indexOf("=");
      // Strip a trailing "  # comment", as .env.example uses on PORT=8787 lines.
      return [line.slice(0, index).trim(), line.slice(index + 1).replace(/\s+#.*$/, "").trim()];
    }),
);

const required = ["MONAD_RPC_URL", "RELAYER_PRIVATE_KEY", "AGENT_PRIVATE_KEY"];
const missing = required.filter((key) => !env[key] || env[key] === "0x");
if (missing.length > 0) {
  console.error(red(`\nMissing required values in .env: ${missing.join(", ")}\n`));
  console.error("See .env.example for what each one is for.\n");
  process.exit(1);
}

const deploymentName = (env.THUNAI_DEPLOYMENT || "").trim();
const deployment = join(root, "contracts", "deployments", deploymentName ? `10143.${deploymentName}.json` : "10143.json");
const hasDeployment = existsSync(deployment) || Boolean(env.THUNAI_VAULT_ADDRESS);
if (!hasDeployment) {
  console.error(red("\nNo deployment found for Monad testnet.\n"));
  console.error("  pnpm contracts:deploy\n");
  process.exit(1);
}

console.log(purple("\n  THUNAI") + dim("  ·  family is your second key\n"));

const notes = [];
notes.push(
  env.ANTHROPIC_API_KEY
    ? green(`  ✓ classifier       ${env.CLASSIFIER_MODEL || "claude-opus-5-5"}`)
    : yellow("  • classifier       deterministic rules (no ANTHROPIC_API_KEY)"),
);
notes.push(
  env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY
    ? green("  ✓ guardian paging  web push + WhatsApp")
    : yellow("  • guardian paging  WhatsApp link only (no VAPID keys)"),
);
notes.push(
  env.AGORA_ENABLED === "true"
    ? green("  ✓ settlement       Agora Instant Settlement")
    : yellow("  • settlement       disclosed fallback (AGORA_ENABLED=false)"),
);
notes.push(
  env.EXPO_PUBLIC_RELAYER_URL?.includes("localhost")
    ? yellow("  • phones           relayer is on localhost; real devices need a LAN IP or tunnel")
    : green(`  ✓ phones           ${env.EXPO_PUBLIC_RELAYER_URL || "(default)"}`),
);
console.log(notes.join("\n"));
console.log();

// ---- shared secrets ---------------------------------------------------------
// The agent is reachable through the same tunnel as the app, so its webhooks need a secret that
// only the relayer holds. If .env does not set one, make one for this run and hand it to both.
if (!env.INTERNAL_TOKEN) env.INTERNAL_TOKEN = randomBytes(24).toString("hex");
if (!env.DEV_ADMIN_TOKEN) {
  console.log(yellow("  • dev endpoints    off (/fund, /keeper/tick, /classify need DEV_ADMIN_TOKEN)"));
}
if (env.TESTNET_PARTNER_STANDIN !== "true") {
  console.log(yellow("  • money from home  \"Send money now\" is off (set TESTNET_PARTNER_STANDIN=true on testnet)"));
}

// ---- URLs and passkeys -----------------------------------------------------
// A passkey is created for one host and works only there. Open the app from a different host
// and every account made on the old one is out of reach. So the host has to be permanent, and it
// has to be HTTPS (or localhost), or the browser will not offer a passkey at all.
function hostOf(value) {
  try {
    return new URL(value);
  } catch {
    return undefined;
  }
}
const isLocal = (u) => ["localhost", "127.0.0.1", "[::1]"].includes(u.hostname);
const appUrl = hostOf(env.APP_URL || "");
const relayerUrl = hostOf(env.EXPO_PUBLIC_RELAYER_URL || "");
const agentUrl = hostOf(env.EXPO_PUBLIC_AGENT_URL || "");
const urlWarnings = [];
if (!appUrl) {
  urlWarnings.push("APP_URL is not a valid URL. Invite links and alerts will point nowhere.");
} else {
  if (appUrl.protocol !== "https:" && !isLocal(appUrl)) {
    urlWarnings.push(
      `APP_URL is ${appUrl.origin}. Passkeys need HTTPS or localhost, so sign-in will not work from there.`,
    );
  }
  if (appUrl.protocol === "https:") {
    for (const [name, u] of [["EXPO_PUBLIC_RELAYER_URL", relayerUrl], ["EXPO_PUBLIC_AGENT_URL", agentUrl]]) {
      if (u && u.protocol !== "https:" && !isLocal(u)) {
        urlWarnings.push(`${name} is plain HTTP while the app is HTTPS, so the browser will block those calls.`);
      }
    }
  }
  if (!isLocal(appUrl)) {
    urlWarnings.push(
      `Passkeys are tied to ${appUrl.hostname}. Keep that host forever (a reserved ngrok domain or a Vercel URL), because changing it orphans every passkey made on it.`,
    );
  }
}
if (urlWarnings.length > 0) {
  for (const line of urlWarnings) console.log(yellow(`  ! ${line}`));
  console.log();
}

// ---- ports ----------------------------------------------------------------

async function portFree(port) {
  return new Promise((resolve) => {
    const server = createServer();
    server.once("error", () => resolve(false));
    server.once("listening", () => server.close(() => resolve(true)));
    server.listen(port, "127.0.0.1");
  });
}

const ports = [
  [Number(env.PORT || 8787), "relayer"],
  [Number(env.AGENT_PORT || 8788), "agent"],
];
for (const [port, name] of ports) {
  if (!(await portFree(port))) {
    console.error(red(`Port ${port} (${name}) is already in use. Stop that process first.\n`));
    process.exit(1);
  }
}

// ---- processes ------------------------------------------------------------

const children = [];

function start(name, colour, cwd, args) {
  // Pass .env through explicitly: Expo only reads its own folder, so without this the app
  // would always fall back to localhost for EXPO_PUBLIC_RELAYER_URL and friends.
  const child = spawn("pnpm", args, {
    cwd: join(root, cwd),
    shell: true,
    env: { ...process.env, ...env },
  });
  children.push(child);
  const prefix = colour(`[${name}]`.padEnd(10));
  const pipe = (stream, out) =>
    stream?.on("data", (data) => {
      for (const line of data.toString().split("\n")) {
        if (line.trim()) out.write(`${prefix} ${line}\n`);
      }
    });
  pipe(child.stdout, process.stdout);
  pipe(child.stderr, process.stderr);
  child.on("exit", (code) => {
    if (code !== 0 && code !== null) console.error(red(`${prefix} exited with ${code}`));
  });
  return child;
}

function shutdown() {
  for (const child of children.reverse()) {
    try {
      if (process.platform === "win32") {
        spawnSync("taskkill", ["/pid", String(child.pid), "/f", "/t"], {
          shell: true,
          stdio: "ignore",
        });
      } else {
        child.kill("SIGTERM");
      }
    } catch {
      /* already gone */
    }
  }
}
process.on("SIGINT", () => {
  console.log(dim("\nstopping…\n"));
  shutdown();
  process.exit(0);
});
process.on("exit", shutdown);

start("relayer", (s) => `\x1b[36m${s}\x1b[0m`, "relayer", ["exec", "tsx", "watch", "src/index.ts"]);
start("agent", (s) => `\x1b[35m${s}\x1b[0m`, "agent", ["exec", "tsx", "watch", "src/index.ts"]);
start("app", (s) => `\x1b[32m${s}\x1b[0m`, "app", ["exec", "expo", "start"]);

console.log(dim("  Ctrl-C to stop everything.\n"));
