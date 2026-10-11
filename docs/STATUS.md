# Status

The single source of truth for what works. Every claim in the README, `docs/SUBMISSION.md` and on the
landing page must match one of the three lists below. Last updated after the final testnet run.

## Verified on Monad testnet

`pnpm e2e:testnet` plays the whole scene against the live relayer and agent with fresh random keys.
Latest run, 12 Oct 2026, on a **Quicknode** RPC: **101 checks, all passed**, vault
`0x3aC3F87d6713390aCfeD85133Ca662d7a2ADCf87`. (Earlier runs, 16 beats and 86 checks, also passed.)
Raw numbers: [`e2e-testnet.json`](e2e-testnet.json).

| Capability | What the run proves |
|---|---|
| Two-step onboarding | No family exists onchain until the guardian accepts, and then it carries two real passkeys. |
| Passkey verification onchain | Envelope, hold decisions, liveness, notes and unfreeze are verified by the contract at the P256 precompile (`0x0100`). |
| Scheduled rent | A payee on the signed schedule is paid straight through. |
| Hold on a new payee | Held, the money leaves the spendable balance, and the payee receives nothing. |
| Guardian stop | The held amount returns to the student. |
| Fail-safe expiry | An unanswered hold returns the money by itself (a 25-second timeout in this run). |
| Check on the student | Request and proof, and an unanswered check holds new payments. |
| Network warning | A reported payee raises the hold level for the next family. |
| Silent SOS | One signature freezes the family and emits `SOSRaised`. Only the guardian's passkey lifts it. |
| Encrypted notes, stored onchain | Ciphertext stored by the person's passkey, read back by "a fresh device", opened only by the right key; an altered blob and a replayed write are refused. |
| Stateless read-back | A passkey address alone finds the family, the envelope and the notes again from the chain. |
| Lock-down | `/fund`, the agent's webhooks and dev routes need their tokens and do not exist without them. Deposits need the guardian's own signature and are capped and replay-proof. |
| Web push subscription | Only the family member's own key can subscribe a device to alerts. |
| Pay a new person by name and phone | A name and a phone number become a payee with no address typed or shown; the same number typed two ways is the same person; a number without a country code is refused; the parent's hold card reads the name and a masked contact; a report follows the contact, so the next family typing it is held for the network's reason. |
| Chainlink CRE endpoints on the agent | `/cre/apply` and `/cre/status` answer only the CRE token, accept three actions, re-check the chain before acting (not due, not open, not yet), and the agent's own timer stays as a standby. |
| ERC-8004 | Agent #2187 is registered under the team account. A family's guardian account records a verified save; a stranger's key, a different call, a hold nobody stopped and a repeat are all refused. |

**Measured timings (live testnet, latest run, 23 confirmed transactions):** median **1.31 s**, fastest **0.65 s**,
slowest **1.83 s**. These are how long the relayer waited for each transaction's receipt. Use no other latency
figure anywhere.

**Verified live, read-only:**
- `pnpm agora:check` against the real pair: the Agora-ready vault is built on the pair's real CTK and AUSD, handles
  the 18-decimal CTK, and is **not** whitelisted.
- `/traction` and `/stats` count the contracts' own events from the deploy block; at the time of writing it shows
  **0 real families** and our own test runs.

**Verified locally (Foundry, 95 tests):** all of the above at contract level, plus the allowance staying in the app,
SOS reason codes, notes replay protection, 18-decimal CTK handling, and a **fork test against the real Agora pair**
(`MONAD_FORK_URL=... forge test --match-contract RealAgoraFork`) that proves the real pair refuses an unwhitelisted vault
and our fallback survives it. `pnpm parity` proves TypeScript and Solidity agree on every challenge hash.

## Full verification, 12 Oct 2026

| Check | Result |
|---|---|
| `forge test` | 95 passed, 0 failed |
| Fork test against the real Agora pair | passed (`MONAD_FORK_URL=... forge test --match-contract RealAgoraFork`) |
| `pnpm parity` | TypeScript and Solidity agree on every value |
| `pnpm check:indexer` | config, schema and handlers consistent with the contracts |
| `pnpm typecheck` | 0 errors in every package |
| `pnpm e2e` (private local chain) | passed, every beat including the new-person and CRE beats |
| `pnpm e2e:testnet` (live Monad testnet, Quicknode RPC) | passed, 101 checks |
| Shared unit tests (`pnpm --filter @thunai/shared test`) | 7 passed (contact rules, same person however typed, masking) |
| `pnpm agora:check` against the live pair | **not ready, as expected**: token and decimals handling pass; the vault is not whitelisted |
| Landing page production build | compiled, `/` and `/traction` |
| Deployed site (Vercel) | `https://companion-monad.vercel.app/`, `/traction`, `/app`, a deep link and the service worker all answer 200 |
| `scripts/serve.mjs` (relayer and agent behind one port, as on Render) | run locally: `/health` reaches the relayer, `/agent/health` reaches the agent |
| App web export | built; the bundle has no Tamil text and no secrets or RPC keys |

A failure found and fixed during this pass: Monad checks a sender's gas budget against its balance from about three
blocks earlier, so a guardian account topped up a moment ago looked empty to the network and its feedback transaction
was refused. The relayer now waits until the top-up is visible at that lag before handing the transaction back.
A second cause of an earlier failure was not code: the stand-in money for the test runs had been used up, so the
first deposit reverted. It was topped up (the tokens are worthless by design).

## RPC provider

The relayer and agent use a **Quicknode** endpoint (`MONAD_RPC_URL` in `.env`, never committed). It supports
`eth_sendRawTransactionSync` (confirmed by the relayer's own check). Its Discover plan limits `eth_getLogs` to a
**5-block range**, so the relayer's event counting reads logs from the public RPC through a separate setting,
`LOGS_RPC_URL`. If you change the main RPC and its log range is small, set `LOGS_RPC_URL` too.

## Built but unverified

| Thing | Why it is unverified |
|---|---|
| **The Chainlink CRE workflow** (`cre/`) | Typechecks against `@chainlink/cre-sdk` 1.23, and the agent endpoints it calls are tested. `cre workflow simulate` has **not run**: it needs `cre login`, which the account owner must do. Not deployed to the CRE network. CRE does not write onchain in our design. |
| **The Render service** | `render.yaml` and `scripts/serve.mjs` are written and the launcher runs locally, but the service has not been created on Render, so the deployed site's `/relayer` and `/agent` do not answer yet. |
| **The notes key from a real passkey (PRF)** | The e2e uses a deterministic stand-in for the authenticator's PRF output, because a script cannot do WebAuthn PRF. The encryption, storage and read-back are real. `getPasskeyPrfOutput` with the `thunai/notes` salt is written and typechecks, but has not run on a phone. |
| **Web push delivery to a real browser** | Service worker, signed enrolment and the agent's send are built. No browser has received an alert. On iPhone it needs the app added to the Home Screen. |
| **Every Face ID flow on a physical phone** | Run in a desktop browser and in tests with software passkeys. Not yet on one Android and one iPhone. |
| **Silent SOS, the notes card, alerts card, session prompt and "How fast" card as screens** | They render and typecheck and the backend they call is tested, but nobody has tapped through them on a phone. |
| **The Agora swap succeeding on the real pair** | Needs the vault whitelisted as `APPROVED_SWAPPER` and real CTK in the relayer. See `docs/AGORA_REQUEST.md`. |
| **The Agora-ready vault `0xF2BA20FaF5f171DcDB9E7F70a489855d170465C1`** | Deployed on the real tokens; passes the token and decimals checks. Not whitelisted, and the running app does not use it. |
| **The Envio indexer** | Config, schema and handlers match the compiled ABI (`pnpm check:indexer`) and point at the real deployment, but it has never run. The app reads it first and falls back to the relayer's own event counts. |
| **The LLM explanation** | The Anthropic account has no credit, so every hold used the rules' own explanation. |
| **The ERC-8004 feedback from the app** | The relayer path is verified on testnet by the e2e. The app's background call after a stop (session signs the transaction) has not run on a phone. |

## Not done

| Thing | Why |
|---|---|
| **Envio deployed** | Needs you to connect the repo on envio.dev. Steps: `docs/ENVIO_DEPLOY.md`. |
| **Cleanverse** | Blocked: `docs.cleanverse.com` is behind an invitation code, and the three CCP PDFs are not in `docs/vendor/` yet, so nothing was built. Drop them in (and the invitation code, if the site is needed) to resume Phase 7 with a 3-hour time box; if neither is available, drop Cleanverse. |
| **Aurora Intents** | **Skipped, by decision.** Aurora's docs list Monad as supported for source and destination but never mention a testnet, anywhere (checked the docs index and the Intents Connect, Deposits and Swap chain pages). Only a mainnet flow is documented, which would need real funds and our contracts on mainnet, so nothing was built and nothing was spent. If Aurora's team confirms testnet support, Phase 8 can be picked up with a 3-hour time box. |
| **Relayer and agent online** | The site is live on Vercel at `https://companion-monad.vercel.app`; the always-on Render service behind it is not created yet (account owner's step). Until it is, the deployed app cannot reach a server. |
| **The repository shared with the organisers** | It is public at `github.com/SamuelDharshi/Companion`; share it with `metropolis@hackathon.monad.xyz` if it is made private. |
| **Alchemy** | Monad testnet is supported by Alchemy. Not integrated: it needs an Alchemy key. The relayer reads an optional `ALCHEMY_RPC_URL` for log reads and nothing else uses it. |
| **Logo, demo video, pitch video** | Yours to produce; the scripts are in `docs/DEMO.md`. |
| **A native app** | Face ID works in the phone's browser, not in Expo Go. |
| **Real families** | None yet on the new vault. The traction page says 0, honestly. |

## Checked against Monad's own documentation

Read from the pages in the hackathon resources list, 11 Oct 2026:

| Page | What it confirms or changes for us |
|---|---|
| [Precompiles](https://docs.monad.xyz/developer-essentials/precompiles) | P256 verify is at `0x0100` (EIP-7951), 160-byte input, 6,900 gas. Exactly what the vault calls. |
| [Reserve balance](https://docs.monad.xyz/developer-essentials/reserve-balance) | Every ordinary account keeps a **10 MON reserve**: a transfer that leaves the sender below it reverts. Our gas top-ups send value from the relayer, so the relayer now refuses to sponsor (HTTP 503) rather than fail mid-rescue, and `/config` reports `relayerAboveReserve`. **Keep the relayer above about 12 MON** (it was 12.76 after testing). |
| [Mera guide](https://docs.monad.xyz/guides/mera) | Confirms passkeys are tied to their `rpId` (our one-permanent-host rule) and that Monad charges the declared gas limit (we found this the hard way). **On desktop Chrome only passkeys saved in Google Password Manager return PRF**, otherwise Mera throws `PRF_UNAVAILABLE`. Holding a session keeps the key in page memory while it is live; ours ends after 15 minutes and `end()` zeroes it. |
| [ERC-8004 guide](https://docs.monad.xyz/guides/erc-8004) | Its registry addresses (`0x8004A169...`, `0x8004BAa1...`) are the **mainnet** ones: we checked they have no code on testnet. Ours (`0x8004A818...`, `0x8004B663...`) are the testnet registries and have code there. Feedback is permanent and immutable, which is why ours carries no family, payee or handle. |
| [Envio on Monad testnet](https://envio.dev/chains/monad-testnet) | Monad testnet (10143) has first-class HyperIndex and HyperSync support, and Envio Cloud has a free tier. So the hosted deploy in `docs/ENVIO_DEPLOY.md` is supported. |

## Things to know

- **Redeployed contracts.** The vault was redeployed for this work (new events, notes storage, decimals). Families made on the
  earlier vault (`0x117E83...`) are gone from the app, and the relayer's old records are archived, not deleted. Anyone who
  tested earlier must create a new account.
- **Test traffic is real transactions.** Our own e2e runs create fictional families on testnet. The traction page reports
  them apart from real families, and the ERC-8004 reputation recorded so far comes from those runs.
- **Reserved gas.** Monad charges for the gas limit, so the relayer sizes a guardian's gas top-up from the real fee numbers.

## Honest limits (copy these into the submission)

- Testnet only. The tokens are labelled stand-ins and carry no real value.
- The Agora swap is built but switched off until Agora whitelists our vault.
- Face ID works in the phone's browser, not inside Expo Go.
- It protects money held in the app, not the student's bank account. Silent SOS and Check on Arjun break the isolation instead.
- Parent alerts reach her by WhatsApp link and by opening the app. Browser push is built but not proven on a device.
- The AI explanation is optional. Fixed rules decide every hold, and a model can never move or release money.
- Envio is not deployed. The Chainlink CRE simulation has not run. Alchemy is not integrated. Cleanverse and Aurora are not built.
