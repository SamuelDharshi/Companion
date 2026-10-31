# BLI video script (under 2 minutes)

Record only what really happened. Skip any line marked [NEEDS RUN] if that run has not been completed.

| Time | Screen | Say |
|---|---|---|
| 0:00-0:15 | Landing page | "Scammers win by cutting a student off from family. Companion makes family the second key." |
| 0:15-0:45 | `cre/companion-orchestrator/main.ts` | "A Chainlink CRE workflow runs every minute. It reads the vault on Monad, decides from the contract's numbers, calls our AI agent over HTTPS, then records the completed action in an audit log." |
| 0:45-1:20 | Terminal running `cre workflow simulate`, then explorer | "This is a real simulation: here are the live family and hold counts." [NEEDS RUN] "Here the agent acted, and here is the audit transaction." |
| 1:20-1:45 | `docs/LEGAL_AND_CONSUMER_PROTECTION.md` | "Only a parent's passkey can release money. Silence refunds the student. Every automated action leaves a timestamped record for a dispute or complaint." |
| 1:45-2:00 | README links | "It is a testnet prototype, and the code and evidence are public." |
