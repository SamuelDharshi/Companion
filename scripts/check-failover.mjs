#!/usr/bin/env node
/**
 * Proves the RPC failover: with a primary RPC that is down, requests still succeed on Alchemy, and when the primary is
 * healthy the primary answers. Read-only. Needs ALCHEMY_RPC_URL (and optionally MONAD_RPC_URL) in .env.
 *
 * Run: pnpm check:failover
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createChain } from "../packages/evm/src/chain.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const env = Object.fromEntries(
  readFileSync(join(root, ".env"), "utf8")
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).replace(/\s+#.*$/, "").trim()];
    }),
);
if (!env.ALCHEMY_RPC_URL) {
  console.error("ALCHEMY_RPC_URL is not set in .env");
  process.exit(1);
}
const log = { info() {}, warn() {}, debug() {} };
const key = `0x${"11".repeat(32)}`; // never signs or sends anything here
let failed = false;
const check = (ok, message) => {
  console.log(`  ${ok ? "ok  " : "FAIL"} ${message}`);
  if (!ok) failed = true;
};

// 1. Primary is down (nothing listens on port 1): Alchemy must answer.
const down = await createChain({ rpcUrl: "http://127.0.0.1:1", fallbackRpcUrl: env.ALCHEMY_RPC_URL, privateKey: key }, log);
const block = await down.publicClient.getBlockNumber();
check(down.chainId === 10143 && block > 0n, `primary down: Alchemy answered (chain ${down.chainId}, block ${block})`);

// 2. Primary is healthy: it answers, and the fallback is not needed.
if (env.MONAD_RPC_URL) {
  const both = await createChain({ rpcUrl: env.MONAD_RPC_URL, fallbackRpcUrl: env.ALCHEMY_RPC_URL, privateKey: key }, log);
  const head = await both.publicClient.getBlockNumber();
  check(both.chainId === 10143 && head > 0n, `primary healthy: answered normally (block ${head})`);
}

// 3. Without a fallback the dead primary fails, so the check above really did use Alchemy.
let threw = false;
try {
  await createChain({ rpcUrl: "http://127.0.0.1:1", privateKey: key }, log);
} catch {
  threw = true;
}
check(threw, "without the fallback, a dead primary fails (so step 1 really used Alchemy)");

process.exit(failed ? 1 : 0);
