#!/usr/bin/env node
/**
 * Registers Companion's agent in the ERC-8004 Identity registry on Monad testnet.
 *
 * The identity NFT is owned by the team's deployer account, never by the vault: the vault is money
 * and the agent's identity should be able to change hands without touching it. The registration
 * file describes what the agent is and where it lives. It contains no family, no payee and no scam
 * handle, because identity metadata is public and permanent.
 *
 * Idempotent: if contracts/deployments/erc8004.json already names an agent, it only checks it.
 *
 * Run: node scripts/register-agent.mjs
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createPublicClient, createWalletClient, decodeEventLog, http, parseAbi } from "viem";
import { privateKeyToAccount } from "viem/accounts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(root, "contracts", "deployments", "erc8004.json");
const IDENTITY = "0x8004A818BFB912233c491871b3d84c89A494BD9e";
const REPUTATION = "0x8004B663056A597Dffe9eCcC1965A193B7388713";

const env = { ...Object.fromEntries(readFileSync(join(root, ".env"), "utf8").split("\n").map((l) => l.trim()).filter((l) => l && !l.startsWith("#") && l.includes("=")).map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).replace(/\s+#.*$/, "").trim()]; })), ...process.env };
const chain = { id: 10143, name: "monad-testnet", nativeCurrency: { name: "MON", symbol: "MON", decimals: 18 }, rpcUrls: { default: { http: [env.MONAD_RPC_URL] } } };
const pub = createPublicClient({ chain, transport: http(env.MONAD_RPC_URL) });
const abi = parseAbi([
  "function register(string agentURI) returns (uint256 agentId)",
  "function ownerOf(uint256 tokenId) view returns (address)",
  "function tokenURI(uint256 tokenId) view returns (string)",
  "event Registered(uint256 indexed agentId, string agentURI, address indexed owner)",
]);

if (existsSync(OUT)) {
  const existing = JSON.parse(readFileSync(OUT, "utf8"));
  const owner = await pub.readContract({ address: IDENTITY, abi, functionName: "ownerOf", args: [BigInt(existing.agentId)] });
  console.log(`Already registered: agent #${existing.agentId}, owned by ${owner}.`);
  process.exit(0);
}

const account = privateKeyToAccount(env.DEPLOYER_PRIVATE_KEY);
const wallet = createWalletClient({ account, chain, transport: http(env.MONAD_RPC_URL) });
const appUrl = env.APP_URL || "http://localhost:8081";

const registration = {
  type: "https://eips.ethereum.org/EIPS/eip-8004#registration-v1",
  name: "Companion guardian agent",
  description:
    "Runs a family's weekly allowance, explains why a payment was held, and pages the parent. It never holds keys and can never move or release money: holds come from contract rules and only the parent's passkey releases one.",
  image: "",
  services: [{ name: "web", endpoint: appUrl }],
  x402Support: false,
  active: true,
  supportedTrust: ["reputation"],
};
const agentURI = `data:application/json;base64,${Buffer.from(JSON.stringify(registration)).toString("base64")}`;

const hash = await wallet.writeContract({ address: IDENTITY, abi, functionName: "register", args: [agentURI] });
const receipt = await pub.waitForTransactionReceipt({ hash });
let agentId;
for (const log of receipt.logs) {
  if (log.address.toLowerCase() !== IDENTITY.toLowerCase()) continue;
  try {
    const ev = decodeEventLog({ abi, data: log.data, topics: log.topics });
    if (ev.eventName === "Registered") agentId = ev.args.agentId;
  } catch {
    /* a Transfer event from the NFT, not the one we want */
  }
}
if (agentId === undefined) throw new Error("Registered, but no agent id was found in the receipt. Check the transaction.");

writeFileSync(OUT, JSON.stringify({ chainId: 10143, identityRegistry: IDENTITY, reputationRegistry: REPUTATION, agentId: agentId.toString(), owner: account.address, txHash: hash, registeredAt: new Date().toISOString() }, null, 2) + "\n");
console.log(`Registered agent #${agentId} (owner ${account.address}) in ${hash}`);
