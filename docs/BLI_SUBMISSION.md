# BLI Legal Tech Hackathon 2 Submission

**Name:** Companion (Thunai)

**Tagline:** Scammers win by cutting you off from family. Companion makes family your second key.

**Description:** Companion is a family money agent for Indian parents with a child studying abroad. It sends a weekly allowance, flags likely scams and holds risky payments until a family member responds. A Chainlink CRE workflow watches the vault on Monad testnet, decides what is due and instructs the agent over HTTPS. CRE and the agent can never pay a payee: only a parent's passkey can release held funds.

**Tracks:** LegalTech & RegTech; Web3 for Social Good

**Bounty:** Chainlink, Best workflow with CRE

## Requirement evidence

| Requirement | Where | Evidence |
|---|---|---|
| CRE workflow as orchestration layer | cre/companion-orchestrator/main.ts | Cron trigger, chain read, decision, agent instruction |
| Blockchain integration | Same file, Multicall3 reads of the vault | docs/evidence/cre-simulate-2026-10-31.log: 17 families, 57 holds on Monad testnet |
| External system or AI agent | HTTPClient to POST /agent/cre/apply | docs/cre-simulation.txt (2026-10-12): 4 holds expired, 1 parent reminded, 0 failed |
| Successful CLI simulation | CRE CLI v1.33.0 | docs/evidence/cre-simulate-2026-10-31.log |

## Disclosures

- The 2026-10-31 simulation had nothing due, so it made no agent call. The agent-call evidence is the 2026-10-12 run.
- The workflow is simulated, not deployed to the CRE network, so there is no workflow ID.
- The workflow reads the chain but does not write through CRE. The agent's keeper key sends transactions.
- The optional AI risk step and on-chain audit contract were not added for this hackathon.
- Testnet only.

## Provenance

Originally built for Monad Metropolis, where it also entered Chainlink's CRE bounty.

New for this hackathon: the legal and consumer protection analysis, a fresh simulation log, this submission and the video script.

## Tech stack

Chainlink CRE (TypeScript SDK), Monad testnet, Solidity, Multicall3, the Companion agent over HTTPS, passkeys verified by the P256 precompile.

## Links

- Repo: https://github.com/SamuelDharshi/Companion
- App: https://companion-monad.vercel.app
- Agent: https://companion-api-27cv.onrender.com
- Vault: 0xF2BA20FaF5f171DcDB9E7F70a489855d170465C1 (Monad testnet)
- Existing CRE video: https://www.youtube.com/watch?v=daIYA_BimC0

## Team

To be completed by the team.
