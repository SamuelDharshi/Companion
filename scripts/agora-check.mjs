#!/usr/bin/env node
/**
 * Is the real Agora Instant Settlement path ready for our vault?
 *
 * The pair has no role getter we can read, so this asks it the only way that is honest: it
 * simulates a zero-amount swap FROM the vault (and from the relayer) with `eth_call`, and reads the
 * revert. The pair refuses a caller without APPROVED_SWAPPER with a custom error that carries the
 * role (0x20), so that revert means "not whitelisted" and anything else means the gate was passed.
 * Nothing is sent and nothing is spent.
 *
 * When every line below is green, setting AGORA_ENABLED=true and calling `setAgora(pair, true)`
 * on the vault is all that is left. The vault already approves the pair for CTK, converts CTK's
 * 18 decimals to AUSD's 6, and falls back safely if a swap ever fails.
 *
 * Run: pnpm agora:check
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createPublicClient, encodeFunctionData, http, parseAbi } from "viem";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const green = (s) => `\x1b[32m${s}\x1b[0m`;
const red = (s) => `\x1b[31m${s}\x1b[0m`;
const yellow = (s) => `\x1b[33m${s}\x1b[0m`;
const dim = (s) => `\x1b[90m${s}\x1b[0m`;

function readEnv() {
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
const env = { ...readEnv(), ...process.env };

// The vault we ask Agora to whitelist is the Agora-ready one, built on the pair's real tokens. It sits
// beside the main deployment (the one the app uses) so whitelisting never disturbs a running demo.
const agoraFile = join(root, "contracts", "deployments", "10143.agora.json");
const deployment = JSON.parse(
  readFileSync(existsSync(agoraFile) ? agoraFile : join(root, "contracts", "deployments", "10143.json"), "utf8"),
);
const PAIR = env.AGORA_PAIR_ADDRESS || deployment.agoraPair;
const FACTORY = "0x8468587Af422ad440F58a57E955eCA6A970b5375";
const ROLE_ERROR_SELECTOR = "0xc13dd0f3"; // the pair's "missing role" custom error

const client = createPublicClient({ transport: http(env.MONAD_RPC_URL || "https://testnet-rpc.monad.xyz") });
const pairAbi = parseAbi([
  "function name() view returns (string)",
  "function token0() view returns (address)",
  "function token1() view returns (address)",
  "function getPrice() view returns (uint256)",
  "function getPriceNormalized() view returns (uint256)",
  "function APPROVED_SWAPPER() view returns (bytes32)",
  "function swapExactTokensForTokens(uint256,uint256,address[],address,uint256) returns (uint256[])",
]);
const erc20 = parseAbi([
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function balanceOf(address) view returns (uint256)",
]);
const vaultAbi = parseAbi([
  "function ctk() view returns (address)",
  "function ausd() view returns (address)",
  "function agoraEnabled() view returns (bool)",
  "function agoraPair() view returns (address)",
  "function ctkScale() view returns (uint256)",
]);

let ready = true;
const line = (ok, text, note = "") => {
  if (!ok) ready = false;
  console.log(`  ${ok ? green("ok  ") : red("FAIL")} ${text}${note ? dim("  " + note) : ""}`);
};
const info = (text) => console.log(`  ${dim("•")} ${text}`);
const read = (address, abi, functionName, args = []) => client.readContract({ address, abi, functionName, args });
const fmt = (n, dec) => (Number(n) / 10 ** dec).toLocaleString("en-US", { maximumFractionDigits: 2 });

console.log(`\nAgora Instant Settlement readiness  ${dim(`pair ${PAIR}`)}\n`);

const [name, token0, token1, price, priceNormalized, roleValue] = await Promise.all([
  read(PAIR, pairAbi, "name"),
  read(PAIR, pairAbi, "token0"),
  read(PAIR, pairAbi, "token1"),
  read(PAIR, pairAbi, "getPrice"),
  read(PAIR, pairAbi, "getPriceNormalized"),
  read(PAIR, pairAbi, "APPROVED_SWAPPER"),
]);
const [sym0, dec0, sym1, dec1] = await Promise.all([
  read(token0, erc20, "symbol"),
  read(token0, erc20, "decimals"),
  read(token1, erc20, "symbol"),
  read(token1, erc20, "decimals"),
]);
console.log("The pair");
info(`${name}: ${sym0} (${dec0} decimals) at ${token0}  ->  ${sym1} (${dec1} decimals) at ${token1}`);
line(priceNormalized > 0n, `getPriceNormalized() = ${(Number(priceNormalized) / 1e18).toFixed(6)}`, `getPrice() = ${price}`);
info(`APPROVED_SWAPPER role value ${roleValue}; factory ${FACTORY}`);
const [liqCtk, liqAusd] = await Promise.all([read(token0, erc20, "balanceOf", [PAIR]), read(token1, erc20, "balanceOf", [PAIR])]);
info(`pair liquidity: ${fmt(liqCtk, dec0)} ${sym0}, ${fmt(liqAusd, dec1)} ${sym1}`);

console.log("\nOur vault");
const vault = deployment.thunaiVault;
const [vCtk, vAusd, vEnabled, vPair, vScale] = await Promise.all([
  read(vault, vaultAbi, "ctk"),
  read(vault, vaultAbi, "ausd"),
  read(vault, vaultAbi, "agoraEnabled"),
  read(vault, vaultAbi, "agoraPair"),
  read(vault, vaultAbi, "ctkScale"),
]);
info(`vault ${vault}`);
line(
  vCtk.toLowerCase() === token0.toLowerCase() && vAusd.toLowerCase() === token1.toLowerCase(),
  "the vault is built on the pair's real CTK and AUSD",
  vCtk.toLowerCase() === token0.toLowerCase()
    ? ""
    : `vault uses ${vCtk} / ${vAusd}: stand-ins. A swap cannot work until the vault is deployed with CTK_ADDRESS=${token0} and AUSD_ADDRESS=${token1}`,
);
line(vScale === 10n ** BigInt(dec0 - 6), `CTK decimals handled (scale ${vScale})`, `${sym0} has ${dec0} decimals, AUSD has 6`);
info(`agoraEnabled on the vault: ${vEnabled}, pair set: ${vPair}`);

console.log("\nThe role gate (simulated swap, nothing is sent)");
const path = [token0, token1];
const callData = encodeFunctionData({
  abi: pairAbi,
  functionName: "swapExactTokensForTokens",
  args: [0n, 0n, path, vault, BigInt(Math.floor(Date.now() / 1000) + 300)],
});
async function gate(label, from, required = true) {
  try {
    await client.call({ account: from, to: PAIR, data: callData });
    line(true, `${label} may swap`, "the pair did not refuse this caller");
    return true;
  } catch (error) {
    const data = String(error.walk?.().data ?? error.data ?? "");
    if (data.startsWith(ROLE_ERROR_SELECTOR)) {
      if (required) line(false, `${label} does NOT hold APPROVED_SWAPPER`, "the pair refused it with its missing-role error");
      else info(`${label} does not hold APPROVED_SWAPPER (not required: only the vault calls the pair)`);
      return false;
    }
    // Any other revert (for example no CTK or no allowance) happens after the role check passed.
    line(true, `${label} passed the role gate`, `reverted later for another reason: ${data.slice(0, 18) || error.shortMessage}`);
    return true;
  }
}
const vaultPasses = await gate("the vault", vault);
await gate("the relayer", deployment.relayer, false);

console.log("\nFunds");
const [relayerCtk, vaultCtk, vaultAusd] = await Promise.all([
  read(token0, erc20, "balanceOf", [deployment.relayer]),
  read(token0, erc20, "balanceOf", [vault]),
  read(token1, erc20, "balanceOf", [vault]),
]);
info(`relayer holds ${fmt(relayerCtk, dec0)} ${sym0}; vault holds ${fmt(vaultCtk, dec0)} ${sym0} and ${fmt(vaultAusd, dec1)} ${sym1}`);
if (relayerCtk === 0n) info(yellow(`the relayer has no real ${sym0}. It is not mintable by us (owner-only), so it has to come from Agora or a faucet.`));

console.log(
  `\n${ready && vaultPasses ? green("Ready: set AGORA_ENABLED=true and call setAgora(pair, true) on the vault.") : red("Not ready.") + " " + yellow("See docs/AGORA_REQUEST.md for the whitelist request to send to Agora.")}\n`,
);
process.exit(ready && vaultPasses ? 0 : 1);
