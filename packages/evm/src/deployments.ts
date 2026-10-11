import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import type { Address } from "viem";
import { MONAD_TESTNET_CHAIN_ID, type DeploymentInfo } from "@thunai/shared";

/**
 * Resolves the deployed addresses.
 *
 * Preference order: explicit environment variables, then the JSON the deploy script wrote.
 * Nothing is hardcoded, so a fresh deploy never leaves a stale address behind in four
 * different packages.
 */
/** Explicit addresses win; anything missing is read from the deploy script's output. */
export type DeploymentOverrides = {
  thunaiVault?: string;
  scamSignals?: string;
};

/**
 * Walks up from the current directory to find `contracts/deployments/<chainId>.json`,
 * so every service resolves the same file regardless of which package it runs from.
 *
 * `THUNAI_DEPLOYMENT=agora` selects `<chainId>.agora.json` instead: the vault built on the real
 * Agora CTK and AUSD. That one setting switches the vault, ScamSignals, both tokens and the Agora
 * flag together, so the services can never end up half on one deployment and half on the other.
 */
export function deploymentFileName(chainId: number): string {
  const name = (process.env.THUNAI_DEPLOYMENT ?? "").trim();
  return name ? `${chainId}.${name}.json` : `${chainId}.json`;
}

function findDeploymentFile(chainId: number): string | undefined {
  let dir = process.cwd();
  for (let i = 0; i < 6; i++) {
    const candidate = join(dir, "contracts", "deployments", deploymentFileName(chainId));
    if (existsSync(candidate)) return candidate;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return undefined;
}

export function loadDeployment(
  overrides: DeploymentOverrides = {},
  chainId = MONAD_TESTNET_CHAIN_ID,
): DeploymentInfo {
  let fromFile: Partial<DeploymentInfo> = {};
  const path = findDeploymentFile(chainId);
  if (path) {
    try {
      fromFile = JSON.parse(readFileSync(path, "utf8"));
    } catch {
      // Not fatal: the addresses may come entirely from the environment.
    }
  }

  const vault = (overrides.thunaiVault || fromFile.thunaiVault) as Address | undefined;
  const signals = (overrides.scamSignals || fromFile.scamSignals) as Address | undefined;

  if (!vault || !signals) {
    throw new Error(
      `No deployment found for chain ${chainId}. Either set THUNAI_VAULT_ADDRESS and ` +
        `SCAM_SIGNALS_ADDRESS, or run \`pnpm contracts:deploy\` so ` +
        `contracts/deployments/${chainId}.json exists.`,
    );
  }

  return {
    chainId: fromFile.chainId ?? chainId,
    thunaiVault: vault,
    scamSignals: signals,
    ctk: (fromFile.ctk ?? "0x0000000000000000000000000000000000000000") as Address,
    ausd: (fromFile.ausd ?? "0x0000000000000000000000000000000000000000") as Address,
    relayer: (fromFile.relayer ?? "0x0000000000000000000000000000000000000000") as Address,
    agent: (fromFile.agent ?? "0x0000000000000000000000000000000000000000") as Address,
    agoraPair: (fromFile.agoraPair ?? "0x0000000000000000000000000000000000000000") as Address,
    agoraEnabled: fromFile.agoraEnabled ?? false,
    standInTokens: fromFile.standInTokens ?? true,
  };
}
