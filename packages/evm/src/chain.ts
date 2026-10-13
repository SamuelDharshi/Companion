import {
  createPublicClient,
  createWalletClient,
  defineChain,
  fallback,
  http,
  type Address,
  type Hex,
  type PublicClient,
  type TransactionReceipt,
  type WalletClient,
} from "viem";
import { privateKeyToAccount, nonceManager } from "viem/accounts";
import { monadTestnet } from "@thunai/shared";

export type SentTransaction = {
  hash: Hex;
  receipt: TransactionReceipt;
  /** Round-trip in milliseconds: what the app shows as "0.8s". */
  latencyMs: number;
  /**
   * True when the receipt came back in the same request via
   * `eth_sendRawTransactionSync`, false when we had to fall back to polling.
   * Surfaced all the way to the UI so a latency figure is never overstated.
   */
  sync: boolean;
};

export type Chain = {
  publicClient: PublicClient;
  walletClient: WalletClient;
  account: ReturnType<typeof privateKeyToAccount>;
  /** Sponsors and submits a call, preferring Monad's synchronous send. */
  send(args: { to: Address; data: Hex; label: string; value?: bigint }): Promise<SentTransaction>;
  /** Broadcasts a transaction somebody else already signed, such as a guardian's own feedback. */
  sendSigned(serialized: Hex, label: string): Promise<SentTransaction>;
  /** The chain id the RPC actually reported. */
  chainId: number;
  /** Whether this RPC answered a sync send at least once. */
  syncSupported(): boolean | undefined;
};

/** Minimum config a service needs to put a transaction on chain. */
export type ChainConfig = {
  rpcUrl: string;
  /**
   * A second RPC (Alchemy's Monad testnet endpoint). Every request goes to `rpcUrl` first, and if that errors, the
   * same request is retried on this one, so one provider's outage cannot stop a rescue. Optional.
   */
  fallbackRpcUrl?: string;
  /** Pays gas. Holds no spending power: the contract enforces that. */
  privateKey: string;
};

export type ChainLogger = {
  info: (...args: any[]) => void;
  warn: (...args: any[]) => void;
  debug: (...args: any[]) => void;
};

export async function createChain(config: ChainConfig, log: ChainLogger): Promise<Chain> {
  // Primary first, then the configured fallback (Alchemy), then Monad's public RPC as the last resort, so a provider that is
  // down or out of quota cannot stop a rescue. A local or forked node (not Monad testnet) never falls back to the public RPC.
  const PUBLIC_MONAD_RPC = "https://testnet-rpc.monad.xyz";
  const urls = [config.rpcUrl, config.fallbackRpcUrl].filter((u): u is string => Boolean(u));
  const onMonad = /monad|quiknode|alchemy/i.test(config.rpcUrl);
  if (onMonad && !urls.includes(PUBLIC_MONAD_RPC)) urls.push(PUBLIC_MONAD_RPC);
  const transport =
    urls.length > 1
      ? fallback(
          urls.map((u) => http(u)),
          // viem's default stops on some provider errors, such as Quicknode's -32003 "daily request limit reached". Only a
          // contract revert is the same on every RPC; anything else (rate limit, quota, outage) tries the next one.
          { rank: false, retryCount: 1, shouldThrow: isRevert },
        )
      : http(config.rpcUrl);
  const account = privateKeyToAccount(config.privateKey as Hex, { nonceManager });

  // Ask the node which chain it is rather than assuming Monad, so the same relayer runs
  // unchanged against Monad testnet, a local Anvil (`pnpm e2e`) or a fork. Hardcoding the
  // chain here is what makes a relayer silently refuse to sign on anything else.
  const detectedId = Number(
    await createPublicClient({ transport }).request({ method: "eth_chainId" }),
  );
  const chain =
    detectedId === monadTestnet.id
      ? monadTestnet
      : defineChain({
          ...monadTestnet,
          id: detectedId,
          name: `Chain ${detectedId}`,
          rpcUrls: { default: { http: [config.rpcUrl] } },
        });
  if (detectedId !== monadTestnet.id) {
    log.warn({ detectedId }, "not Monad testnet — running against a local or forked node");
  }

  const publicClient = createPublicClient({ chain, transport });
  const walletClient = createWalletClient({ account, chain, transport });

  /**
   * Monad answers `eth_sendRawTransactionSync` with the receipt in the same round-trip,
   * which is what lets the app show a result instead of a spinner. Not every provider
   * exposes it, so the first failure is remembered and later sends skip straight to the
   * ordinary path rather than paying for a doomed request each time.
   */
  let syncSupported: boolean | undefined;

  async function send({
    to,
    data,
    label,
    value,
  }: {
    to: Address;
    data: Hex;
    label: string;
    value?: bigint;
  }): Promise<SentTransaction> {
    const started = performance.now();

    const request = await walletClient.prepareTransactionRequest({
      account,
      chain,
      to,
      data,
      ...(value !== undefined ? { value } : {}),
    });
    const serialized = await walletClient.signTransaction(request as never);
    return broadcast(serialized, label, started);
  }

  async function sendSigned(serialized: Hex, label: string): Promise<SentTransaction> {
    return broadcast(serialized, label, performance.now());
  }

  async function broadcast(serialized: Hex, label: string, started: number): Promise<SentTransaction> {
    if (syncSupported !== false) {
      try {
        const receipt = await publicClient.request({
          method: "eth_sendRawTransactionSync",
          params: [serialized],
        } as never) as TransactionReceipt | null;

        if (receipt && receipt.transactionHash) {
          syncSupported = true;
          const latencyMs = performance.now() - started;
          log.debug({ label, latencyMs, sync: true }, "sent");
          return { hash: receipt.transactionHash, receipt: normalize(receipt), latencyMs, sync: true };
        }
        // A null or malformed answer means the method is not really supported here.
        throw new Error("eth_sendRawTransactionSync returned no receipt");
      } catch (error) {
        if (syncSupported === undefined) {
          syncSupported = false;
          log.warn(
            { err: (error as Error).message },
            "eth_sendRawTransactionSync unavailable on this RPC; falling back to polling. Latency claims will say so.",
          );
        }
        // The transaction may already be in flight. Re-sending identical bytes is safe:
        // it is the same signed transaction and therefore the same hash.
      }
    }

    const hash = await publicClient.request({
      method: "eth_sendRawTransaction",
      params: [serialized],
    });
    const receipt = await publicClient.waitForTransactionReceipt({ hash, pollingInterval: 50 });
    const latencyMs = performance.now() - started;
    log.debug({ label, latencyMs, sync: false }, "sent");
    return { hash, receipt, latencyMs, sync: false };
  }

  return { publicClient, walletClient, account, chainId: detectedId, send, sendSigned, syncSupported: () => syncSupported };
}

/**
 * The sync endpoint returns the same shape as `eth_getTransactionReceipt`, i.e. hex
 * quantities, while viem's typed receipt uses bigints. Normalise the fields anything
 * downstream actually reads.
 */
function normalize(receipt: any): TransactionReceipt {
  const toBigInt = (v: unknown) => (typeof v === "string" ? BigInt(v) : (v as bigint));
  return {
    ...receipt,
    blockNumber: receipt.blockNumber != null ? toBigInt(receipt.blockNumber) : receipt.blockNumber,
    gasUsed: receipt.gasUsed != null ? toBigInt(receipt.gasUsed) : receipt.gasUsed,
    cumulativeGasUsed:
      receipt.cumulativeGasUsed != null ? toBigInt(receipt.cumulativeGasUsed) : receipt.cumulativeGasUsed,
    effectiveGasPrice:
      receipt.effectiveGasPrice != null ? toBigInt(receipt.effectiveGasPrice) : receipt.effectiveGasPrice,
    status: receipt.status === "0x1" || receipt.status === 1 || receipt.status === "success" ? "success" : "reverted",
  } as TransactionReceipt;
}

/** True only for a contract revert, which another RPC would answer the same way. */
function isRevert(error: Error): boolean {
  const text = `${(error as any).details ?? ""} ${error.message}`;
  return /revert/i.test(text) && !/limit|capacity|quota|rate/i.test(text);
}
