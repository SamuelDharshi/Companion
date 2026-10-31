# DoraHacks submission: BLI Legal Tech Hackathon 2

Resolve every [TODO] before pasting.

**BUIDL name:** Companion (Thunai)

**Tagline:** Family as the second key against scams, orchestrated by Chainlink CRE.

## Description

**Problem.** Students abroad are pushed into scam payments while being told not to contact family, and recovery after a
transfer is often difficult.

**Solution.** Companion runs a family allowance on Monad testnet. Unusual payments move to escrow and a parent is paged.
Only the parent's passkey can release them, and an unanswered hold refunds the student.

**How CRE orchestrates it.** A cron workflow reads the vault through `EVMClient`, decides what is due from contract state,
calls the Companion AI agent over authenticated HTTPS, and sends a signed report to `CompanionAuditLog` for each completed
action. The agent re-checks the chain before acting.

**Legal and consumer-protection design.** Consent by passkey, cooling-off holds, default-safe refunds, shared scam signals
and an audit trail. See `docs/LEGAL_AND_CONSUMER_PROTECTION.md`.

**New for this hackathon.** `CompanionAuditLog` and its tests, the workflow's audit write, the AI risk step, the legal document and fresh
evidence. Companion was originally built for Monad Metropolis, where it also entered Chainlink's CRE bounty.

**Limits.** Testnet only, no real families, and no independent audit or legal review. [TODO: state whether the live agent
is run by CRE or by its own keeper at submission time.] [TODO: state deployment status.]

**Tracks:** LegalTech & RegTech, Web3 for Social Good, AI x Blockchain

**Bounty:** Chainlink "Best workflow with CRE"

| Requirement | Evidence |
|---|---|
| Workflow as orchestration layer | `cre/companion-orchestrator/main.ts` |
| Blockchain plus AI agent | `docs/evidence/cre-simulate-2026-10-31.log` shows Monad reads. [TODO: run showing a 2xx agent call] |
| Simulation or deployment | `docs/evidence/cre-simulate-2026-10-31.log`. [TODO: audit transaction link] |

**Tech stack:** Chainlink CRE (TS SDK), Monad testnet, Solidity/Foundry, passkeys (P-256), Node agent, Envio, Alchemy, Next.js

**Links:** GitHub https://github.com/SamuelDharshi/Companion · App https://companion-monad.vercel.app · Video [TODO] ·
Vault https://testnet.monadexplorer.com/address/0xF2BA20FaF5f171DcDB9E7F70a489855d170465C1 · Audit log [TODO]

**Team:** [TODO]
