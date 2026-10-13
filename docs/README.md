# Companion docs

Every guide in one place. Start with the first three; the rest are for a specific job.

## Start here

| Doc | What it is for |
|---|---|
| [`../README.md`](../README.md) | The product: the idea, how it works (with diagrams), how to use it, architecture, honest limits |
| [`SUBMISSION.md`](SUBMISSION.md) | The hackathon submission: the track's five criteria, and one section per bounty answering its exact questions |
| [`STATUS.md`](STATUS.md) | The source of truth: what is verified, what is built but unverified, what is not done. Every claim elsewhere must match it |

## Live links

| What | Where |
|---|---|
| Website (landing page) | https://companion-monad.vercel.app |
| The app | https://companion-monad.vercel.app/app |
| Relayer and agent (Render) | https://companion-api-27cv.onrender.com (`/health`, `/agent/health`) |
| Envio GraphQL | https://indexer.dev.hyperindex.xyz/228e4fb/v1/graphql |
| Code | https://github.com/SamuelDharshi/Companion |

## By sponsor

| Sponsor | Guide | Where the code is |
|---|---|---|
| **Agora** (Instant Settlement) | [`AGORA.md`](AGORA.md) | `contracts/src/ThunaiVault.sol` (`_settle`), `scripts/agora-testnet-setup.mjs`, `scripts/agora-check.mjs` |
| **Mera** (passkeys, three keys) | [`SUBMISSION.md` → Mera UX](SUBMISSION.md#mera-ux), [Many Keys](SUBMISSION.md#mera-many-keys) | `app/src/mera/account.ts`, `app/src/mera/webauthn.ts`, `packages/shared/src/notes.ts` |
| **Envio** (indexer) | [`ENVIO_DEPLOY.md`](ENVIO_DEPLOY.md) | `indexer/config.yaml`, `indexer/schema.graphql`, `indexer/src/EventHandlers.ts`, `app/src/network.ts` |
| **Chainlink** (CRE workflow) | [`../cre/README.md`](../cre/README.md), output in [`cre-simulation.txt`](cre-simulation.txt) | `cre/companion-orchestrator/main.ts`, agent `/cre/apply` in `agent/src/index.ts` |
| **Alchemy** (failover, webhook) | [`ALCHEMY.md`](ALCHEMY.md) | `packages/evm/src/chain.ts` (failover), `agent/src/alchemy.ts` (webhook) |

## Running, deploying, demoing

| Doc | What it is for |
|---|---|
| [`DEPLOY.md`](DEPLOY.md) | How the site (Vercel) and the relayer and agent (Render, free plan) are deployed, and how to redeploy |
| [`ENVIO_DEPLOY.md`](ENVIO_DEPLOY.md) | The Envio indexer: settings, the `envio` branch, and what broke the first build |
| [`ALCHEMY.md`](ALCHEMY.md) | Alchemy failover RPC and the alert webhook (query, URL, signing key) |
| [`AGORA.md`](AGORA.md) | Agora Instant Settlement: addresses, setup, topping up CTK, checking it is live |
| [`../cre/README.md`](../cre/README.md) | The Chainlink CRE workflow: what it reads and does, how to run the simulation |
| [`DEMO.md`](DEMO.md) | Scripts for the 3-minute demo, the 2-minute pitch, and one 2-minute video per bounty; what to do if something fails |
| [`AGORA_REQUEST.md`](AGORA_REQUEST.md) | The original whitelist request. No longer needed on testnet; kept for a mainnet conversation |
| [`../.env.example`](../.env.example) | Every setting, explained. Secrets live only in `.env` and the Render dashboard |

## Commands

```bash
pnpm install                  # once
pnpm dev                      # relayer + agent + app locally, with a readiness report
pnpm web:dev                  # the website with the app at /app, on http://localhost:3000
```

| Command | What it checks or does |
|---|---|
| `pnpm contracts:test` | 95 Foundry tests, real P256 assertions |
| `pnpm typecheck` | Every TypeScript package |
| `pnpm parity` | TypeScript and Solidity agree on every hash |
| `pnpm e2e` | The whole rescue on a private local chain |
| `pnpm e2e:testnet` | The same on live Monad testnet through a running relayer and agent; records timings to `e2e-testnet.json`. Point it at the deployed site with `E2E_RELAYER_URL=https://companion-monad.vercel.app/relayer E2E_AGENT_URL=https://companion-monad.vercel.app/agent` |
| `E2E_CRE_DEMO=1 pnpm e2e:testnet` | Adds a real open hold and runs the CRE simulation against it (needs `cre login` and `pnpm dev`) |
| `pnpm check:indexer` | The indexer config against Envio's own schema, and every event against the ABI |
| `ENVIO_GRAPHQL_URL=… pnpm check:envio` | Every query the app and site use, against the live indexer |
| `pnpm check:failover` | The Alchemy failover: a dead primary RPC is answered by Alchemy |
| `pnpm agora:check` | Whether the vault may swap on the Agora pair (read-only) |
| `pnpm agora:setup` | Agora testnet self-service: approval, test AUSD, CTK for the relayer |
| `pnpm agora:enable` | Turns the Agora swap on for the vault |
| `pnpm --filter @thunai/shared test` | Contact rules for paying a person by name and phone |
| `pnpm --filter @thunai/agent test` | The Alchemy webhook's signature and log parsing |
| `node scripts/render-env.mjs` | Writes `.render.env` (git-ignored) with the values to paste into Render |

## Code map

| Folder | What is in it |
|---|---|
| `contracts/` | `ThunaiVault.sol` (balances, envelopes, holds, SOS, notes, Agora settlement), `ScamSignals.sol` (network reports), tests, deploy script, `deployments/` |
| `relayer/` | Pays gas, carries signed intents, pays a person by name and phone (`/payee/resolve`), counts the contracts' events (`/stats`) |
| `agent/` | Allowance keeper, hold classifier and pager, CRE endpoints, Alchemy webhook |
| `app/` | The Expo app, both roles: student and parent |
| `frontend/` | The website: landing page (with the 3D globe), and the app served at `/app` |
| `indexer/` | Envio HyperIndex 3 |
| `cre/` | Chainlink CRE workflow |
| `packages/shared`, `packages/evm` | Code shared by all of the above: ABIs, hashes, notes encryption, payee rules, chain client |
| `scripts/` | Deploy, end-to-end tests, checks, Agora setup, build and hosting helpers |
