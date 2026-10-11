#!/usr/bin/env node
/**
 * Turns the real Agora Instant Settlement on for the Agora-ready vault, once Agora has whitelisted it.
 *
 * It refuses to do anything until `pnpm agora:check` passes, so it cannot switch on a path that would
 * only fall back. Then it calls `setAgora(pair, true)` from the deployer (the vault's owner) and checks
 * the flag onchain. Nothing here moves money.
 *
 * Afterwards: set THUNAI_DEPLOYMENT=agora in .env, set THUNAI_START_BLOCK=70125617, restart `pnpm dev`,
 * give the relayer real CTK, then re-run `pnpm e2e:testnet` and record the Agora video on that vault.
 *
 * Run: pnpm agora:enable
 */
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createPublicClient, createWalletClient, http, parseAbi } from "viem";
import { privateKeyToAccount } from "viem/accounts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const file = join(root, "contracts", "deployments", "10143.agora.json");

const check = spawnSync(process.execPath, [join(root, "scripts", "agora-check.mjs")], { stdio: "inherit" });
if (check.status !== 0) {
  console.error("\nNot enabling Agora: the readiness check did not pass. Get the vault whitelisted first (docs/AGORA_REQUEST.md).\n");
  process.exit(1);
}

const env = { ...Object.fromEntries(readFileSync(join(root, ".env"), "utf8").split("\n").map((l) => l.trim()).filter((l) => l && !l.startsWith("#") && l.includes("=")).map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).replace(/\s+#.*$/, "").trim()]; })), ...process.env };
const deployment = JSON.parse(readFileSync(file, "utf8"));
const chain = { id: 10143, name: "monad-testnet", nativeCurrency: { name: "MON", symbol: "MON", decimals: 18 }, rpcUrls: { default: { http: [env.MONAD_RPC_URL] } } };
const pub = createPublicClient({ chain, transport: http(env.MONAD_RPC_URL) });
const wallet = createWalletClient({ account: privateKeyToAccount(env.DEPLOYER_PRIVATE_KEY), chain, transport: http(env.MONAD_RPC_URL) });
const abi = parseAbi(["function setAgora(address pair, bool enabled)", "function agoraEnabled() view returns (bool)"]);

const hash = await wallet.writeContract({ address: deployment.thunaiVault, abi, functionName: "setAgora", args: [deployment.agoraPair, true] });
await pub.waitForTransactionReceipt({ hash });
const on = await pub.readContract({ address: deployment.thunaiVault, abi, functionName: "agoraEnabled" });
if (!on) throw new Error("setAgora was sent but the vault still reports Agora off. Check the transaction.");

writeFileSync(file, JSON.stringify({ ...deployment, agoraEnabled: true }, null, 2) + "\n");
console.log(`\nAgora Instant Settlement is ON for vault ${deployment.thunaiVault} (${hash}).`);
console.log("Next: THUNAI_DEPLOYMENT=agora and THUNAI_START_BLOCK=70125617 in .env, restart pnpm dev, fund the relayer with real CTK, pnpm e2e:testnet.\n");
