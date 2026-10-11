#!/usr/bin/env node
/**
 * The same end-to-end scene as `pnpm e2e`, run against the LIVE Monad testnet through the running
 * relayer and agent (`pnpm dev` must be up). Every key is random and discarded; the measured timings
 * are written to docs/e2e-testnet.json.
 *
 * Run: pnpm e2e:testnet
 */
process.env.E2E_TARGET = "testnet";
await import("./e2e.mjs");
