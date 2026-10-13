# Feedback for Monad and the sponsors

We built **Companion** (Thunai) on Monad testnet for Metropolis. It uses Monad, Agora Instant Settlement, Mera, Chainlink CRE, Envio
and Alchemy in one product. Every finding below **happened to us while building it**. Each one names the evidence, the root cause, what
we did about it in this repository, and a fix the sponsor could ship.

We tried to find the problem *behind* each symptom: the design decision that made the bug possible, not only the bug.

---

## Contents

1. [Summary](#summary)
2. [Monad (main track): providers report a rate limit as a rejected transaction](#1-monad-main-track)
3. [Agora: the swap gate is enforced but cannot be read](#2-agora-instant-settlement)
4. [Mera: the SDK throws away the half of the passkey that Monad can verify](#3-mera)
5. [Chainlink CRE: limits count calls, not work, and writes need a contract built for CRE](#4-chainlink-cre)
6. [Envio: a config mistake costs a deployment slot](#5-envio)
7. [Alchemy: limits measured in blocks break on a chain with 0.4 s blocks](#6-alchemy)
8. [The pattern behind several findings](#7-the-pattern-behind-several-findings)
9. [Short versions for the submission form](#8-short-versions-for-the-submission-form)

---

## Summary

| # | Sponsor | The real pain point | Kind | What it cost us | Our fix in this repo | The fix we propose |
|---|---|---|---|---|---|---|
| 1 | **Monad** (RPC ecosystem) | A provider answers "daily limit reached" with JSON-RPC code **-32003** ("transaction rejected") instead of **-32005** ("limit exceeded"). Clients treat -32003 as final, so failover never runs | Bug and missing convention | Our API was in a crash loop on 13 Oct 2026 although two healthy RPCs were configured | `packages/evm/src/chain.ts`: only a contract revert stops the fallback | Publish an error-code convention for Monad RPC partners, with a conformance test |
| 2 | **Agora** | The pair enforces `APPROVED_SWAPPER` but has **no getter** for it. The only way to know is to attempt a swap and decode the revert | Design gap | A "simulate a swap and match selector `0xc13dd0f3`" script, and a vault that must `try/catch` every swap | `scripts/agora-check.mjs`, `_settle` in `ThunaiVault.sol` | `isApprovedSwapper(address)` and a `canSwap(caller, amountIn)` preflight |
| 3 | **Mera** | Mera returns the PRF output but **discards the WebAuthn assertion and the passkey's public key**, so Monad's own P256 precompile cannot verify a Mera user onchain | Architecture | A custom `WebAuthnClient` that swaps in our challenge and reads the public key from the attestation | `app/src/mera/webauthn.ts` | One call that returns PRF outputs **and** an assertion over a caller-chosen challenge, plus the public key |
| 3b | **Mera** | Each ceremony evaluates **one** salt, although WebAuthn PRF evaluates two. "Many keys" costs many Face IDs | API limit | Hand-added `second` salt in our client | `setSecondarySalt` in `app/src/mera/webauthn.ts` | `prfSalts: [a, b]` |
| 3c | **Mera** | When PRF is missing, Mera fails **after** creating the passkey, which stays on the device, unusable | Bug (documented) | Users could collect dead passkeys | `assertPrfSupported()` in `app/src/mera/account.ts` | Check `getClientCapabilities()` before the ceremony |
| 4 | **Chainlink CRE** | The per-run limit counts **chain calls (15)**, not the data read | Architecture | Multicall3 batching to stay at 2 reads | `cre/companion-orchestrator/main.ts` | A batched-read capability counted by gas or bytes |
| 4b | **Chainlink CRE** | Onchain writes require the target contract to implement `onReport`. A deployed contract can't be orchestrated without a redeploy | Architecture | We route actions through our agent over HTTP | `cre/README.md` | A standard receiver adapter that forwards allowlisted calls |
| 4c | **Chainlink CRE** | A side-effecting HTTP POST runs on **every node** unless the workflow opts into `cacheSettings` | Unsafe default | We set `cacheSettings` and made the agent idempotent | `callAgent` in `main.ts`, `/cre/apply` in `agent/src/index.ts` | Single-execution as the default for non-GET requests |
| 5 | **Envio** | Envio Cloud validates the config only at **codegen**, after a deployment slot (3 on the free plan) is used | DX and quota | A failed build, and a deploy slot gone | `pnpm check:indexer` validates against Envio's own JSON schema | Validate before counting a deployment, plus `envio migrate` for v2 to v3 |
| 6 | **Alchemy** | Free-tier `eth_getLogs` and block-triggered webhooks are **measured in blocks**. On Monad, 10 blocks is about 4 seconds, and a webhook can fire about 2.5 times a second | Architecture | Quota used up; we could not use Alchemy for event history | Envio for history, Alchemy for failover and filtered alerts | Limits in seconds of chain time, and webhooks that fire only on matches |

---

## 1. Monad (main track)

### Monad's RPC providers report a rate limit as "transaction rejected", so failover never runs

**What happened.** On 13 October 2026 our relayer (on Render) went into a crash loop. The log said:

```
RpcRequestError: RPC Request failed.
Details: daily request limit reached
code: -32003
[serve] relayer exited (1)
```

We had **three** RPCs configured: Quicknode (primary), Alchemy (failover) and Monad's public RPC (last resort), wrapped in viem's
`fallback` transport. The primary was out of quota, and the other two were healthy. The service still died at its first request
(`eth_chainId`).

**The real pain point.** EIP-1474 reserves **-32005 "Limit exceeded"** for rate limits. **-32003 is "Transaction rejected"**. A client
library is right to treat a rejected transaction as final: sending the same transaction to a second node would not change the answer.
viem does exactly that: its `fallback` stops on `TransactionRejectedRpcError` (-32003), and so does any client that follows the spec.
When a provider puts a quota error under the rejection code, **every correctly written failover in the ecosystem skips itself**. A
redundancy setup that looks right in a config file then fails at the moment it was meant for.

**Root cause.** Nothing in Monad's developer docs tells RPC partners which codes to use for quota, capacity or method-not-supported. Each
provider picks, and clients learn the differences one outage at a time. Monad makes this worse than elsewhere. A fast chain encourages
chatty apps (keepers, sync sends, polling at 50 ms), so free quotas run out in hours, not weeks.

**What could have been done.**

- Agree on the codes once, for every partner on the docs' RPC page: -32005 for rate limit and quota, -32601 for an unsupported method,
  and `data.retryAfter` in seconds.
- Ship a small conformance test (a script that triggers each condition and checks the code) that a provider passes before being listed.

**A near-perfect solution.**

```jsonc
// What a provider should return when a quota is used up
{ "jsonrpc": "2.0", "id": 1,
  "error": { "code": -32005, "message": "daily request limit reached",
             "data": { "retryAfter": 3600, "scope": "daily", "provider": "quicknode" } } }
```

The provider sends the right code, the client's failover works with no change, and `retryAfter` lets clients back off instead of
hammering a dead endpoint.

**What we did.** `packages/evm/src/chain.ts` now passes viem a `shouldThrow` that stops the fallback **only for a contract revert**,
because a revert is the one answer every node gives the same way. Any other error (rate limit, quota, outage, wrong code) moves to the
next RPC. We tested it against a fake RPC that returns Quicknode's exact error: the request fell through to Monad's public RPC and returned
chain 10143. Commit `b78a3e3`; the service came back within a minute of the push.

### A second, smaller one: `eth_sendRawTransactionSync` cannot be discovered

Monad's synchronous send is what lets our app show "confirmed" instead of a spinner. Some providers support it and some don't, and the
only way to find out is to send a real transaction and see whether it fails. We remember the first failure per RPC (`syncSupported` in
`chain.ts`) and fall back to polling, and the app labels the latency honestly. **The proposed fix:** list it in a capabilities call
(for example `rpc_modules`, or a Monad-specific `monad_capabilities`), so a client knows before its first send.

**Summary.** Monad's RPC partners need one shared contract for errors and capabilities. Without it, the speed the chain offers is lost to
guessing at the edges.

---

## 2. Agora Instant Settlement

### The swap gate is enforced, but it cannot be read

**What happened.** Our vault swaps CTK to AUSD on Agora's CTK/AUSD pair (`0x1Aa8958A…`) inside every allowance and deposit. The pair
only lets an approved address swap. It exposes the role's *id* (`APPROVED_SWAPPER()`), but **no getter that says whether an address holds
it**. There is no `hasRole`, `isApprovedSwapper` or `getRoleMembers`.

**The real pain point.** An integrator cannot answer the most basic question, *"will my contract's swap be accepted?"*, without
attempting it. In practice:

- A payments app cannot show "instant settlement ready" before the user's first transfer.
- Monitoring cannot alert when an approval is revoked. You find out when a family's allowance falls back.
- The only check is to simulate a swap and decode the revert. Our `scripts/agora-check.mjs` matches the missing-role custom error
  (`0xc13dd0f3`, which carries the role) to tell "not approved" apart from "approved, but no balance".

**Root cause.** Access control was designed for *enforcement*, not *introspection*. On mainnet the gate stands for KYC, which makes the
state even more important to read: a business needs to know its compliance status from the chain, not from an email.

**A second gap (testnet).** Monad testnet has **no CTK faucet**, and CTK is the pair's *input* token. To test the documented direction
(CTK to AUSD), we had to take AUSD from Agora's faucet and swap it **backwards** into CTK first (`scripts/agora-testnet-setup.mjs`,
step 3).

**What could have been done.** Add one `view` function per gate, and a faucet for every token a documented flow starts from.

**A near-perfect solution.**

```solidity
interface IAgoraPairIntrospection {
    function isApprovedSwapper(address account) external view returns (bool);

    /// One call that answers "would this swap go through, and if not, why?"
    enum SwapBlocker { None, NotApproved, Paused, InsufficientLiquidity, BelowMinimum }
    function canSwap(address caller, address tokenIn, uint256 amountIn)
        external view returns (SwapBlocker blocker, uint256 expectedOut);
}
```

`canSwap` also gives integrators the quote they should pass as `amountOutMin`, so a "set it to 0" shortcut (which we disclose for our
own vault) has no reason to exist.

**What we did.**

- `pnpm agora:check` simulates the gate without sending anything.
- The vault wraps the swap in `try/catch`, emits `Payout(…, viaAgora)`, and refuses to credit AUSD it does not hold (`UnbackedCredit`).
- The app's network screen counts settlements through Agora against the fallback. In our live data that is **18 through Agora, 0
  through the fallback**.

**Summary.** The gate works; it just can't be seen. One view function turns a revert-decoding script into a status light.

---

## 3. Mera

### 3a. The SDK throws away the half of the passkey that Monad can verify

**What happened.** Companion needs the guardian's decision ("stop this payment") to be **verified inside the contract**, so no server can
fake it. Monad ships a P256 precompile (`0x0100`, EIP-7951) for exactly this. To use it, the contract needs:

1. a WebAuthn **assertion** (signature, authenticatorData, clientDataJSON) over **our action hash**, and
2. the passkey's **P256 public key** (x, y).

Mera 0.2.0 gives neither:

- It **generates the challenge itself** (32 random bytes) and does not let the caller set it.
- Its `GetCredentialResult` keeps only `credentialId` and `prfOutput`. The assertion is dropped.
- Its `CreateCredentialResult` has no public key.

**The real pain point.** Monad's headline account primitive (Mera passkeys) and its headline crypto primitive (the P256 precompile)
**cannot be used together** out of the box. Every app that wants a Mera user's approval verified onchain must either ask for a second
Face ID through another library or patch the WebAuthn layer, as we did.

**Root cause.** Mera models the passkey as a **key-derivation device** (PRF in, keys out). A WebAuthn ceremony produces two independent
artefacts, a PRF output and a signature, and the API surfaces only the first. Because Mera has no server, it never needed the challenge to
mean anything. So it never let anyone choose it.

**A near-perfect solution.**

```ts
const { prfOutputs, assertion, publicKey } = await mera.authorize({
  rpId,
  credential,
  challenge: actionHash,            // caller-chosen: the thing being approved
  prfSalts: [acctSalt, duressSalt], // up to two per ceremony, as WebAuthn allows
});
// assertion: { authenticatorData, clientDataJSON, r, s }, low-s normalised, ready for P256 / Solady WebAuthn.verify
// publicKey: { x, y }, returned at creation and cached by credentialId
```

One Face ID, three outputs: keys for the app, a signature for the chain, and the public key to register.

**What we did.** `app/src/mera/webauthn.ts` implements Mera's `WebAuthnClient` interface:

- it **replaces Mera's random challenge with our action hash** (armed just before the call and consumed once),
- it **keeps the assertion** and converts the DER signature to low-s `r, s`,
- it **reads the public key** from the attestation at creation.

The contract verifies it with Solady's `WebAuthn` at the precompile. This works because Mera never inspects the challenge. That is an
implementation detail we rely on, not a promise, which is exactly why it belongs in the API.

### 3b. One salt per ceremony, although WebAuthn allows two

WebAuthn's PRF extension evaluates **`first` and `second`** salts in one ceremony. Mera's `WebAuthnClient` request carries a single
`prfSalt`. For a bounty called *One Passkey, Many Keys*, each extra key then costs an extra Face ID. We add the second salt in our client
(`setSecondarySalt`), so one Face ID at sign-up yields both the account key and the duress key.

### 3c. A dead passkey is left behind when PRF is missing

Mera's own documentation says it: *"Any failure after the creation ceremony completes leaves the passkey on the authenticator, but the
thrown error does not carry its metadata."* On a browser without PRF (desktop Chrome with a non-Google password manager, for example),
the user does a Face ID, gets `PRF_UNAVAILABLE`, and keeps a passkey that can never sign in.

**The fix, done in this repo.** Before the ceremony, `assertPrfSupported()` (`app/src/mera/account.ts`) asks the browser through
WebAuthn's `PublicKeyCredential.getClientCapabilities()`. If it says `extension:prf` is false, we explain and never create the passkey.
Browsers without that call are let through, as before. **Proposed for Mera:** do this inside `createPasskeyWithPrfOutput`, and attach
the credential's metadata to the error when a passkey is still created.

**Summary.** Mera is the cleanest account layer we have used. One API change (caller-chosen challenge, assertion and public key returned,
two salts) would make it the natural front end for Monad's P256 precompile instead of something to patch around.

---

## 4. Chainlink CRE

### 4a. The read limit counts calls, not work

**What happened.** CRE allows **15 chain reads per workflow run**. Our workflow checks every family's `allowanceDue` and the state of
every recent hold, so with 13 families and 41 holds it hit the limit at once.

**The real pain point.** The limit counts **`callContract` invocations**, not the cost of what is read. A single Multicall3 call that reads
100 values counts as **one**; 16 tiny reads count as **sixteen**. The rule doesn't protect the network, since the same load passes
through Multicall3. It only pushes every serious workflow into the same workaround and makes the code harder to read.

**What we did.** `cre/companion-orchestrator/main.ts` batches through Multicall3 (`0xcA11…CA11`): one read for the counts, one for every
allowance flag and recent hold. A run is now **2 reads**.

**A near-perfect solution.** A first-class `evmClient.callContracts([...])` that is counted by gas or bytes returned, and runs under the
same consensus as a single call. The limit then matches what it costs the DON.

### 4b. Writes need a contract built for CRE

CRE writes onchain by sending a signed report through a Chainlink forwarder to a contract that implements `onReport`. A contract that is
already deployed, and that holds money, cannot accept CRE writes without a **redeploy**. Adding a second authority to a contract like our
vault, just before a deadline, would be the wrong trade.

**The proposed fix.** A standard, audited **receiver adapter**. It is deployed once per target, verifies the forwarder and the workflow
owner, and calls an **allowlist of selectors** (for us: `runAllowance`, `expireHold`) on an existing contract. Orchestration then becomes
something you add to a protocol, not something you design it around.

**What we did.** The workflow decides; our agent acts over HTTPS (`/cre/apply`, protected by `x-cre-token`) and re-checks the chain before
anything moves. The actions it can trigger can never pay anyone: `runAllowance` runs the envelope a parent already signed, and
`expireHold` only returns money to the student.

### 4c. A side-effecting POST runs on every node by default

`HTTPClient.sendRequest` runs on every node in the DON, which is right for reading a price. For a **POST that does something**, it means
N copies of the action unless the workflow sets `cacheSettings`, which is opt-in and easy to miss. We set
`cacheSettings: { store: true, maxAge: "30s" }` and also made `/cre/apply` idempotent. **Proposed:** make single execution the default
for non-GET methods, and fail simulation with a warning when a POST has no idempotency key.

### 4d. Small things

- `cre workflow simulate` requires `CRE_ETH_PRIVATE_KEY` even for a workflow that sends no transaction. We use a throwaway key with no
  funds.
- The CLI login sent our team member to the authenticator app on every new browser page. Allowing a device code (`cre login --device`)
  would help headless and shared machines.

**Summary.** CRE is the right shape for "a schedule and eyes" over a contract. Counting work instead of calls, plus a receiver adapter,
would let it drive the contracts that already exist.

---

## 5. Envio

### A config mistake costs a deployment slot

**What happened.** Our first Envio Cloud build failed at **codegen**. The config used Envio 2's `networks` key, and Envio 3 calls it
`chains` (handlers also moved to `indexer.onEvent` imported from `envio`). The free development plan allows **3 deployments per
indexer**, and every push to the tracked branch re-indexes from the start block.

**The real pain point.** The cloud discovers a **schema error** only after it has started a build and counted a deployment. With three
slots, one wrong key and one fix use up two thirds of the quota. The CLI can't be run natively on Windows to check first, so Windows
developers learn about the mistake in the cloud.

**A related footgun.** In Envio 3, `event.transaction.hash` is **empty unless `field_selection.transaction_fields` lists it**. A
handler that stores it gets an empty string, not an error, and a UI linking to the explorer shows broken links.

**What we did.** `pnpm check:indexer` (`scripts/check-indexer.mjs`):

- validates `indexer/config.yaml` against the **JSON schema shipped inside the pinned `envio` package**, with Ajv,
- checks every event signature against the compiled contract ABIs,
- runs before any push to the `envio` branch.

We also moved the indexer to its own branch, so app commits don't re-index.

**A near-perfect solution.**

- Validate the config against the schema **before** a build counts as a deployment, and show the exact path (`/networks: unknown
  key, did you mean chains?`).
- Ship `envio migrate` that rewrites a v2 config and handlers to v3.
- Type `event.transaction` from `field_selection`, so reading `hash` without selecting it is a **compile error**, not an empty value.
- Provide a Windows build of the CLI, or a documented Docker one-liner for codegen.

**Summary.** HyperIndex was the easiest part of our stack to make correct once it was running: derived entities, live in minutes, and
the same numbers as the chain. The cost was all in reaching "running", and three checks before the build would remove it.

---

## 6. Alchemy

### Limits measured in blocks break on a chain with 0.4 s blocks

**What happened.**

- **Event history.** Alchemy's free tier allows **10 blocks per `eth_getLogs` request**. On Ethereum, 10 blocks is about 2 minutes of
  history. On Monad, with blocks about every 0.4 s, it is about **4 seconds**. Counting our vault's events since deployment would have
  taken hundreds of thousands of requests, so we use Envio for history.
- **Webhooks.** Our first custom (GraphQL) webhook had no address filter. Custom webhooks are evaluated **per block**, and on Monad that is
  about 2.5 times a second. It delivered thousands of signed messages to our agent (all accepted, signatures valid), and the free
  monthly quota ran out.

**The real pain point.** The limits and the billing are written in **blocks**, a unit whose meaning changes by about 25 times between
chains. A limit tuned for Ethereum is generous there and unusable on Monad. A webhook that costs nothing on a 12-second chain uses up a
quota on a 0.4-second chain. Nothing in the dashboard warns about it before it happens.

**A near-perfect solution.**

- State range limits in **seconds of chain time** (for example, "2 minutes per `eth_getLogs` request"), converted per chain.
- **Deliver webhooks only when the query matches something** by default, and show an estimated cost per day when one is created ("this
  query runs 216,000 times a day on Monad testnet").
- Require at least one address or topic filter on chains with sub-second blocks, or warn loudly when there is none.
- Send a soft-cap email at 50% and 80% of the monthly quota, before keys stop working.

**What we did.**

- **Failover RPC.** Alchemy is the second RPC in our fallback chain, including the synchronous send. `pnpm check:failover` kills the
  primary and checks that Alchemy answers.
- **Filtered alert webhook.** The webhook is now filtered to our vault's address and the two topics that need a parent
  (`HoldOpened`, `SOSRaised`). The agent checks the HMAC signature (`x-alchemy-signature`), re-reads the hold from the chain, and skips
  anything already paged (`agent/src/alchemy.ts`, with tests).
- **No event history through Alchemy.** That job moved to Envio.

**Summary.** Alchemy's Monad support is real and works. Its quotas were designed for slower chains, and expressing them in time instead
of blocks would make the same free tier usable on Monad.

---

## 7. The pattern behind several findings

Four of the six findings share one cause: **Monad is faster than the units its tooling was designed in.**

| Tool | Unit it counts in | Fine on Ethereum | On Monad |
|---|---|---|---|
| Alchemy `eth_getLogs` | 10 blocks | about 2 minutes | about 4 seconds |
| Alchemy custom webhook | once per block | about 7,000 a day | about 216,000 a day |
| CRE chain reads | 15 calls per run | enough for a few reads | pushes everyone to Multicall3 |
| RPC free quotas | requests per day | rarely hit | hit within a day by a keeper and sync sends |

**One proposal for Monad itself:** a short "building for 0.4 s blocks" page in the developer docs. It would cover how to filter
webhooks, which limits to expect from each partner, the error codes partners return, and the batching patterns that keep a fast app
inside free tiers. We learned each of these from an outage; the next team could learn them from a page.

---

## 8. Short versions for the submission form

**Main track (Monad).** Monad's RPC partners need a shared error convention. On 13 Oct 2026 Quicknode answered "daily request limit
reached" with -32003 (EIP-1474's "transaction rejected") instead of -32005 ("limit exceeded"), so viem's fallback treated it as final and
our relayer crash-looped while Alchemy and the public RPC were healthy. We fixed our side (only a contract revert stops the failover).
Monad could publish a code convention and a conformance test for listed providers, and a "building for 0.4 s blocks" page.

**Agora.** The pair enforces `APPROVED_SWAPPER` but exposes no getter, so the only way to know whether a contract may swap is to simulate
a swap and decode the revert (we match `0xc13dd0f3`). An `isApprovedSwapper(address)` view, or a `canSwap(caller, amountIn)` preflight that
also returns the quote, would let apps show settlement status and set `amountOutMin` correctly. Testnet also has no CTK faucet, so we
had to swap faucet AUSD backwards into CTK to test the documented direction.

**Mera, Best UX and Many Keys.** Mera discards the WebAuthn assertion and the public key and picks the challenge itself, so Monad's own
P256 precompile cannot verify a Mera user without patching the WebAuthn client (we did: one Face ID gives both the PRF keys and an
onchain-verifiable signature over our action hash). The client also evaluates one salt per ceremony, although WebAuthn allows two, and
leaves a dead passkey when PRF is missing. We now check `getClientCapabilities()` first. Proposed: `authorize({ challenge, prfSalts })`
returning PRF outputs, assertion and public key.

**Chainlink CRE.** The 15-read limit counts calls, not work, so every real workflow ends up on Multicall3 (ours is 2 reads per run).
Writes need a contract that implements `onReport`, so deployed contracts can't be orchestrated without a redeploy. A standard receiver
adapter with allowlisted selectors would fix that. A side-effecting POST runs on every node unless `cacheSettings` is set; single
execution should be the default for non-GET requests.

**Envio.** Envio Cloud validates the config only at codegen, after a deployment slot is used (3 on the free plan). Our v2 `networks`
key cost one. We now validate against the JSON schema inside the `envio` package before every push. Proposed: pre-build validation,
`envio migrate`, and typing `event.transaction` from `field_selection` so a missing `hash` is a compile error, not an empty string.

**Alchemy.** Free-tier limits are in blocks. On Monad, 10 blocks of `eth_getLogs` is about 4 seconds of history, and a block-triggered
webhook fires about 2.5 times a second; an unfiltered one used up our monthly quota. Proposed: limits in seconds of chain time, webhooks
that fire only on matches with a cost estimate at creation, and soft-cap warnings. We use Alchemy for failover and a vault-filtered,
HMAC-verified alert webhook, and Envio for history.
