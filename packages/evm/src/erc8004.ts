import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { encodeFunctionData, parseAbi, type Address, type Hex } from "viem";

/**
 * ERC-8004 "Trustless Agents": an identity for the agent and a public reputation record.
 *
 * What goes in: the agent's registration (name, what it is, where it lives) and, after a family's
 * parent stops a held payment, one feedback entry from THAT FAMILY'S OWN ACCOUNT. What never goes in:
 * a family, a payee, a scam handle or any amount. Registry data is public and permanent, so it
 * carries only that "a verified save happened".
 *
 * Feedback must come from a client, never from the agent's owner, which is why the family's
 * account gives it and not the team.
 */
export const IdentityRegistryAbi = parseAbi([
  "function ownerOf(uint256 tokenId) view returns (address)",
  "function tokenURI(uint256 tokenId) view returns (string)",
]);

export const ReputationRegistryAbi = parseAbi([
  "function giveFeedback(uint256 agentId, int128 value, uint8 valueDecimals, string tag1, string tag2, string endpoint, string feedbackURI, bytes32 feedbackHash)",
  "function getClients(uint256 agentId) view returns (address[])",
  "function getSummary(uint256 agentId, address[] clientAddresses, string tag1, string tag2) view returns (uint64 count, int128 summaryValue, uint8 summaryValueDecimals)",
]);

export const SAVE_TAG_1 = "verified-save";
export const SAVE_TAG_2 = "guardian-stop";

export type Erc8004 = {
  chainId: number;
  identityRegistry: Address;
  reputationRegistry: Address;
  agentId: string;
  owner: Address;
  txHash: Hex;
};

/** Reads contracts/deployments/erc8004.json, written by scripts/register-agent.mjs. */
export function loadErc8004(): Erc8004 | undefined {
  let dir = process.cwd();
  for (let i = 0; i < 6; i++) {
    const candidate = join(dir, "contracts", "deployments", "erc8004.json");
    if (existsSync(candidate)) {
      try {
        return JSON.parse(readFileSync(candidate, "utf8")) as Erc8004;
      } catch {
        return undefined;
      }
    }
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return undefined;
}

/** The exact call a guardian's account signs. Built here so the relayer can verify it byte for byte. */
export function saveFeedbackCalldata(agentId: bigint, endpoint: string): Hex {
  return encodeFunctionData({
    abi: ReputationRegistryAbi,
    functionName: "giveFeedback",
    args: [agentId, 1n, 0, SAVE_TAG_1, SAVE_TAG_2, endpoint, "", `0x${"00".repeat(32)}`],
  });
}
