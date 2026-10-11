import { defineChain } from "viem";
import { MONAD_TESTNET_CHAIN_ID } from "./constants";

/**
 * Monad testnet.
 *
 * Two things here are load-bearing for Thunai rather than incidental:
 *   - sub-second finality, so a hold, an alert and a guardian's cancel all land while the
 *     scammer is still on the line,
 *   - `eth_sendRawTransactionSync`, which returns the receipt in the same round-trip, so
 *     the app never shows a pending state.
 */
export const monadTestnet = defineChain({
  id: MONAD_TESTNET_CHAIN_ID,
  name: "Monad Testnet",
  nativeCurrency: { name: "MON", symbol: "MON", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://testnet-rpc.monad.xyz"] },
  },
  blockExplorers: {
    default: { name: "MonadVision", url: "https://testnet.monadvision.com" },
  },
  testnet: true,
});

/** Explorer link for the "Details" sheet, for the curious judge. */
export function explorerTxUrl(hash: string): string {
  return `${monadTestnet.blockExplorers.default.url}/tx/${hash}`;
}

export function explorerAddressUrl(address: string): string {
  return `${monadTestnet.blockExplorers.default.url}/address/${address}`;
}
