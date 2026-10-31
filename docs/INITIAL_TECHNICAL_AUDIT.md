# Initial technical audit (2026-10-31)

| Question | Answer | Evidence |
|---|---|---|
| Uses the official CRE SDK? | Yes, `@chainlink/cre-sdk` 1.23.0 installed | `cre/companion-orchestrator/` |
| Reads real Monad state? | Yes: 17 families, 57 holds | `docs/evidence/cre-simulate-2026-10-31.log` |
| Makes an external HTTPS request? | Implemented, but not exercised on 2026-10-31 because nothing was due | same log |
| Calls the AI agent? | Implemented: `/cre/apply`. Without a token it returns 401. | live probe |
| Is the AI response processed? | Partly. The workflow uses status, `skipped` and the script ID for logs. `/cre/apply` does not run a new classification; repage reuses a stored brief. | `agent/src/index.ts` |
| Does the result affect the app? | Not in production today | below |
| Simulation recorded? | Yes, on 2026-10-31 (reads only) | same log |
| Live deployment verifiable? | No. `cre workflow list` in the logged-in org shows only `tally-underwriting-staging`. | CLI output |

## Defects

1. **CRE is not driving production.** `/agent/health` reported `orchestrator: "keeper"` and `creLastSeenAt: null`. Fixing it
   needs `ORCHESTRATOR=cre` on Render, a matching `CRE_TOKEN`, and a deployed or running workflow.
2. **Old evidence does not match the chain.** `docs/cre-simulation.txt` says 19 families and 94 holds, the README says 13
   and 41, and the current vault reads 17 and 57. The older figures should be re-explained or replaced.
3. **Fixed in code, agent redeploy needed:** a missed run could skip the reminder.
4. **Fixed in code, audit log not yet deployed:** the contract now rejects an identical report.
5. **`/cre/apply` keeps hold briefs in memory,** so a restart makes repage skip.
6. **Partly fixed:** assessment and workflow decision rules have tests; the full `/cre/apply` route and classifier do not.
