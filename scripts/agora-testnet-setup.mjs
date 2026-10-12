#!/usr/bin/env node
/**
 * Agora's own testnet self-service, so Companion can use the real Instant Settlement pair on Monad testnet.
 *
 * Agora's docs ("Executing a Swap", "Getting Testnet Tokens"): on testnets a Whitelister contract holds the whitelister role
 * on every pair, and anyone may call `setApprovedSwapper(address)`. An AUSD faucet mints test AUSD. There is no CTK faucet
 * on Monad testnet, so the relayer swaps some faucet AUSD into CTK on the pair itself (it trades at 1:1).
 *
 * Steps, each checked before it acts (safe to run twice):
 *   1. grant APPROVED_SWAPPER to the Agora-ready vault and to the relayer, through the Whitelister
 *   2. take test AUSD from Agora's faucet for the relayer
 *   3. swap part of it into real CTK, so the relayer can fund families the way a remittance partner would
 *   4. let the vault pull the relayer's CTK when a family is funded (an ERC-20 approval, as the stand-in vault has)
 *
 * Run: node scripts/agora-testnet-setup.mjs   (uses RELAYER_PRIVATE_KEY and MONAD_RPC_URL from .env)
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createPublicClient, createWalletClient, formatUnits, http, parseAbi, parseUnits } from "viem";
import { privateKeyToAccount } from "viem/accounts";

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
const dep = JSON.parse(readFileSync(join(root, "contracts", "deployments", "10143.agora.json"), "utf8"));

// From Agora's documentation (Protocol Deployments, Contract Deployments): the same addresses on every testnet.
const WHITELISTER = "0x7c10F56d6f04a51376393a1C3670e966863F6BD5";
const AUSD_FAUCET = "0xd236c18D274E54FAccC3dd9DDA4b27965a73ee6C";
const CTK_TARGET = process.env.CTK_TARGET ?? "6000"; // CTK the relayer should hold after step 3

const chain = { id: 10143, name: "monad-testnet", nativeCurrency: { name: "MON", symbol: "MON", decimals: 18 }, rpcUrls: { default: { http: [env.MONAD_RPC_URL] } } };
const account = privateKeyToAccount(env.RELAYER_PRIVATE_KEY);
const pub = createPublicClient({ chain, transport: http(env.MONAD_RPC_URL) });
const wallet = createWalletClient({ account, chain, transport: http(env.MONAD_RPC_URL) });

const erc20 = parseAbi([
  "function balanceOf(address) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function allowance(address,address) view returns (uint256)",
  "function approve(address,uint256) returns (bool)",
]);
const whitelister = parseAbi(["function setApprovedSwapper(address swapper)"]);
const faucet = parseAbi(["function requestFunds(address to)"]);
const pair = parseAbi([
  "function swapExactTokensForTokens(uint256 amountIn, uint256 amountOutMin, address[] path, address to, uint256 deadline) returns (uint256[])",
]);

const ok = (m) => console.log(`  \x1b[32mok\x1b[0m   ${m}`);
const step = (m) => console.log(`\n${m}`);

async function send(label, request) {
  const { request: req } = await pub.simulateContract({ account, ...request });
  const hash = await wallet.writeContract(req);
  const receipt = await pub.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new Error(`${label} reverted (${hash})`);
  ok(`${label}  ${hash}`);
  return hash;
}

/** True if a zero-amount swap simulated from `who` is accepted, i.e. `who` holds APPROVED_SWAPPER. */
async function canSwap(who) {
  try {
    await pub.simulateContract({
      account: who,
      address: dep.agoraPair,
      abi: pair,
      functionName: "swapExactTokensForTokens",
      args: [0n, 0n, [dep.ctk, dep.ausd], who, BigInt(Math.floor(Date.now() / 1000) + 600)],
    });
    return true;
  } catch (e) {
    // The pair's missing-role error. Any other revert (for example a zero-amount check) means the role check passed.
    return !String(e.shortMessage ?? e.message).includes("0xc13dd0f3") && !String(e.message).includes("0xc13dd0f3");
  }
}

const [ctkDec, ausdDec, mon] = await Promise.all([
  pub.readContract({ address: dep.ctk, abi: erc20, functionName: "decimals" }),
  pub.readContract({ address: dep.ausd, abi: erc20, functionName: "decimals" }),
  pub.getBalance({ address: account.address }),
]);
console.log(`relayer ${account.address}, ${formatUnits(mon, 18)} MON`);

step("1. APPROVED_SWAPPER through Agora's testnet Whitelister");
for (const [label, who] of [["vault", dep.thunaiVault], ["relayer", account.address]]) {
  if (await canSwap(who)) ok(`${label} ${who} already approved`);
  else await send(`approved the ${label} ${who}`, { address: WHITELISTER, abi: whitelister, functionName: "setApprovedSwapper", args: [who] });
}

step("2. Test AUSD from Agora's faucet");
const ctkWanted = parseUnits(CTK_TARGET, ctkDec);
let ctk = await pub.readContract({ address: dep.ctk, abi: erc20, functionName: "balanceOf", args: [account.address] });
let ausd = await pub.readContract({ address: dep.ausd, abi: erc20, functionName: "balanceOf", args: [account.address] });
// The pair trades 1:1, so the AUSD needed is the CTK shortfall in AUSD's decimals (rounded up), plus a small margin.
const shortfall = ctk >= ctkWanted ? 0n : ctkWanted - ctk;
const scale = 10n ** BigInt(ctkDec - ausdDec);
const swapIn = shortfall === 0n ? 0n : (shortfall + scale - 1n) / scale + parseUnits("1", ausdDec);
const ausdNeeded = swapIn;
if (ausd >= ausdNeeded) ok(`relayer already holds ${formatUnits(ausd, ausdDec)} AUSD`);
else {
  await send("faucet requestFunds(relayer)", { address: AUSD_FAUCET, abi: faucet, functionName: "requestFunds", args: [account.address] });
  ausd = await pub.readContract({ address: dep.ausd, abi: erc20, functionName: "balanceOf", args: [account.address] });
  ok(`relayer now holds ${formatUnits(ausd, ausdDec)} AUSD`);
}

step("3. Real CTK for the relayer, swapped from AUSD on the pair");
if (ctk >= ctkWanted) ok(`relayer already holds ${formatUnits(ctk, ctkDec)} CTK`);
else {
  const amountIn = swapIn;
  const allowance = await pub.readContract({ address: dep.ausd, abi: erc20, functionName: "allowance", args: [account.address, dep.agoraPair] });
  if (allowance < amountIn) await send("approved the pair for AUSD", { address: dep.ausd, abi: erc20, functionName: "approve", args: [dep.agoraPair, amountIn] });
  await send(`swapped ${formatUnits(amountIn, ausdDec)} AUSD for CTK`, {
    address: dep.agoraPair,
    abi: pair,
    functionName: "swapExactTokensForTokens",
    args: [amountIn, 0n, [dep.ausd, dep.ctk], account.address, BigInt(Math.floor(Date.now() / 1000) + 600)],
  });
  ctk = await pub.readContract({ address: dep.ctk, abi: erc20, functionName: "balanceOf", args: [account.address] });
  ok(`relayer now holds ${formatUnits(ctk, ctkDec)} CTK`);
}

step("4. The vault may pull the relayer's CTK when a family is funded");
const vaultAllowance = await pub.readContract({ address: dep.ctk, abi: erc20, functionName: "allowance", args: [account.address, dep.thunaiVault] });
if (vaultAllowance >= ctkWanted) ok("already approved");
else await send("approved the vault for the relayer's CTK", { address: dep.ctk, abi: erc20, functionName: "approve", args: [dep.thunaiVault, 2n ** 255n] });

console.log("\nDone. Next: pnpm agora:check, then pnpm agora:enable.\n");
