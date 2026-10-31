# BLI Video Script (under 2 minutes)

**0:00 Problem.** "In a push payment scam, the victim sends the money themselves. Scammers win by isolating them. Companion makes family the second key."

**0:20 Workflow.** Show cre/companion-orchestrator/main.ts. "Every minute, CRE reads the vault on Monad, decides what is due and instructs our agent."

**0:50 Simulation.** Run this live from cre/:

`cre workflow simulate companion-orchestrator --target staging-settings --non-interactive --trigger-index 0`

Point at the real family and hold counts.

**1:15 Proof.** Open docs/cre-simulation.txt and show the run where 4 holds expired and 1 parent was reminded. Open the vault on the Monad testnet explorer.

**1:35 Legal value.** "Only a parent's passkey can release money to a payee. CRE and the agent cannot. Holds carry reason codes, unanswered holds return to the student, and the record can be checked later."

**1:50 Close.** "This is a testnet prototype. Our legal document lists the open questions on liability, custody and remittance rules."
