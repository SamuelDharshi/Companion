# Pre-existing work baseline (ETHGlobal Mumbai)

Recorded 2026-10-31, before the event (Nov 5-7).

**Baseline commit:** `da6df1382ffaf651c4d852582a5ad8c0311c70e3` on `main` (2026-10-13). Everything at that commit is pre-existing.

**Also pre-existing for Mumbai:** branch `bli/cre-audit-log`, built on 2026-10-31 for BLI Legal Tech Hackathon 2:
`CompanionAuditLog`, its tests, the workflow audit write and the BLI documents. None of it may be presented as Mumbai work.

- **CRE:** cron workflow with Monad reads through Multicall3 and an HTTPS call to the agent.
- **Monad:** `ThunaiVault`, `ScamSignals` and Agora settlement on testnet 10143; see `contracts/deployments/`.
- **AI:** optional language-model explanation in `agent/src/classifier.ts`. Fixed contract rules open holds.
- **Tests at baseline:** 95 Foundry tests passing, run 2026-10-31.
- **Prior bounty entry:** Chainlink CRE at Monad Metropolis.

## Unconfirmed

Whether a Continuity project is eligible for the Chainlink prize, and whether a project that entered this bounty elsewhere
may enter again. Both need an answer from ETHGlobal or Chainlink.
