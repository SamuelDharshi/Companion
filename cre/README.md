# Chainlink CRE: Companion's orchestrator

A [Chainlink Runtime Environment](https://docs.chain.link/cre) workflow that runs Companion's two unattended jobs:

1. **Send the weekly allowance** when a family's signed envelope is due.
2. **Look after unanswered holds**: remind the parent, and when time is up, return the money to the student.

CRE is the schedule and the eyes. The agent still does the doing, and no one ever releases money to a payee except a
parent's Face ID.

```
            every minute (CRE cron trigger)
                        │
   ┌────────────────────▼─────────────────────┐
   │ companion-orchestrator (CRE workflow)    │
   │                                          │
   │ 1. READ Monad testnet (chain 10143)      │◄── EVMClient.callContract, on every DON node:
   │      familyCount, holdCount              │      familyCount()  holdCount()
   │      allowanceDue(familyId)              │      allowanceDue(id)  hold(id)
   │      hold(holdId)                        │
   │                                          │
   │ 2. DECIDE from the contract's own        │
   │      numbers: due flag, status,          │
   │      releaseAt, openedAt                 │
   │                                          │
   │ 3. CALL the agent over HTTPS             │── HTTPClient, one node sends (cacheSettings)
   └────────────────────┬─────────────────────┘
                        │ POST /agent/cre/apply   x-cre-token: <CRE_TOKEN>
                        ▼
   ┌──────────────────────────────────────────┐
   │ Companion agent                          │
   │   runAllowance  due?  -> sends it        │   each action is RE-CHECKED against
   │   expireHold    time up? -> money back   │   the chain before it is sent, so a
   │   repage        still open? -> re-page   │   stale or forged request does nothing
   └──────────────────────────────────────────┘
```

## What it can and cannot do

| Action | Effect | Who else may do it on the contract |
|---|---|---|
| `runAllowance` | Runs the envelope the parent already signed with her own Face ID, or says "not due" | anyone, if the envelope is due |
| `expireHold` | Returns an unanswered hold's money **to the student** once its time is up | anyone |
| `repage` | Sends the parent a "still waiting" notification | (not onchain) |

There is no action that pays a payee. Releasing a held payment needs the guardian's passkey, verified inside the vault
by the P256 precompile, and nothing in this workflow holds it.

## How CRE is used, and one honest limit

- **Onchain reads:** yes. The workflow reads the vault on Monad testnet through CRE's EVM capability
  (`monad-testnet` is a supported CRE network).
- **External system:** yes. It calls Companion's agent over HTTPS, authenticated with a secret held in CRE's secret store.
- **Onchain writes: no.** CRE writes onchain by sending a signed report through a Chainlink forwarder to a contract that
  implements `onReport`. `ThunaiVault` does not, and giving a vault that holds family money a second authority just
  before a deadline would be the wrong trade. So the actions are sent by the agent's keeper key, which has gas and no
  authority over family money. If the vault is ever redeployed, adding a receiver and switching the actions to
  `writeReport` is the next step.

## Fallback: nothing is ever left undone

`ORCHESTRATOR=cre` on the agent makes CRE the orchestrator. The agent keeps its own timer as a **standby**: it runs only
if no authenticated CRE call has arrived for `CRE_GRACE_MS` (5 minutes by default). `ORCHESTRATOR=keeper` (the default)
means the agent's timer alone runs the two jobs. Allowances and expiries are idempotent, so if both ever act, the second
is a harmless "not due" or "not open".

## Run the simulation

Prerequisites: the CRE CLI (v1.30.0 or newer, for Monad testnet), Bun 1.2.21 or newer, and a CRE account.

```bash
cre login                       # interactive, opens a browser

cd cre
cp .env.example .env            # then fill it in, see below
cd companion-orchestrator && bun install && cd ..

# 1. against your own local agent (pnpm dev running, ORCHESTRATOR and CRE_TOKEN set in the root .env)
cre workflow simulate companion-orchestrator --target staging-settings \
  --config companion-orchestrator/config.local.json --non-interactive --trigger-index 0

# 2. against the deployed agent
cre workflow simulate companion-orchestrator --target staging-settings --non-interactive --trigger-index 0
```

`cre/.env`:

| Variable | What |
|---|---|
| `CRE_ETH_PRIVATE_KEY` | A throwaway key with no funds. The simulator requires one even though this workflow sends no transactions. Not the relayer's, agent's or deployer's key. |
| `CRE_MONAD_RPC_URL` | `https://testnet-rpc.monad.xyz` is enough. |
| `CRE_TOKEN_ENV` | The same value as `CRE_TOKEN` on the agent. |

A good simulation to record (2 minutes): create a hold from the app so there is something open, wait for
`repageAfterSeconds` (120 s), then run the simulation. The output shows the chain reads, the hold found, and the agent's
answer. `docs/DEMO.md` has the script.

## Status

| | |
|---|---|
| Workflow compiles and typechecks against `@chainlink/cre-sdk` 1.23 | verified |
| Agent endpoints `/cre/apply` and `/cre/status`: token required, three actions, re-check the chain, standby timer | verified in `pnpm e2e` (beat 11c) |
| `cre workflow simulate` | **not run yet**: it needs `cre login`, which has to be done by the account owner |
| Deployed to the CRE network | no |

See [`docs/STATUS.md`](../docs/STATUS.md) for the project-wide list.
