# Status

The single source of truth for what works. Every claim in the README, `docs/SUBMISSION.md` and on the
landing page must match one of the three lists below. Last updated after the final testnet run.

## Verified on Monad testnet

`pnpm e2e:testnet` plays the whole scene against the live relayer and agent with fresh random keys.
Latest run, 12 Oct 2026, on a **Quicknode** RPC: **110 checks, all passed**, vault
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
| Envio indexer (HyperIndex 3.14, Envio Cloud) | Live at `https://indexer.dev.hyperindex.xyz/228e4fb/v1/graphql`, indexing the Agora vault from block 70,125,617 to the chain head. Its families (2), holds (14) and SOS presses (2) match the contract's own counters, and it records all 6 settlements as through Agora. (The first deployment, on the earlier vault, also matched: 20, 101, 17.) All five app and site queries are accepted (`pnpm check:envio`). `/traction` reads it and says "Envio HyperIndex". |
| Traction page family count | Families are counted as real only if our relayer has a record that they signed up themselves. Our own test families, and families the relayer has no record of (its data on the free plan is wiped at each restart), are never counted as real. Before this fix the page wrongly showed 17 real families. |
| **Agora Instant Settlement, live** | The app's vault is now `0xF2BA20FaF5f171DcDB9E7F70a489855d170465C1` on Agora's real testnet CTK and AUSD, approved through Agora's testnet Whitelister. Every `Payout` it has emitted is `viaAgora = true` (6 of 6 when checked), including $3,000 deposits. The full live test through the deployed site passed 110 checks on this vault. The relayer's CTK came from Agora's AUSD faucet, swapped on the pair (`scripts/agora-testnet-setup.mjs`). |
| Chainlink CRE workflow (`cre workflow simulate`, CLI 1.38.0, SDK 1.23.0) | Passes against live Monad testnet, with the agent running locally and again with the deployed agent. It read the vault (19 families, 94 holds) in two chain reads through Multicall3 (CRE allows 15 reads per run), found the open hold the test had just created, and had the agent remind the parent about it (hold 94, classified as the fake-officer scam). In the same run it returned the money on four real unanswered holds. Output saved in `docs/cre-simulation.txt`. `E2E_CRE_DEMO=1 pnpm e2e:testnet` reproduces it. |
| Alchemy failover RPC | Configured on the deployed relayer and agent (their `/config` and `/health` report `rpcFailover: true`). `pnpm check:failover` against the live Alchemy Monad testnet endpoint: with a dead primary Alchemy answers (chain 10143), with a healthy primary the primary answers, and without the fallback the dead primary fails. |
| Alchemy webhook route (`/alchemy/webhook`) | Signature required (HMAC-SHA256 over the raw body), 503 without a key, unsigned or wrongly signed bodies refused, a hold the relayer path missed is paged once, duplicates and repeats are skipped, an already-paged SOS is skipped. `pnpm e2e` beat 12b and 5 unit tests. |
| Chainlink CRE endpoints on the agent | `/cre/apply` and `/cre/status` answer only the CRE token, accept three actions, re-check the chain before acting (not due, not open, not yet), and the agent's own timer stays as a standby. |
| ERC-8004 | Agent #2187 is registered under the team account. A family's guardian account records a verified save; a stranger's key, a different call, a hold nobody stopped and a repeat are all refused. |

**Measured timings (live testnet, latest run, 23 confirmed transactions):** median **0.50 s**, fastest **0.33 s**,
slowest **0.87 s**, run through the deployed site (Vercel) to the deployed relayer (Render). These are how long the relayer waited for each transaction's receipt. Use no other latency
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
| `pnpm e2e:testnet` (live Monad testnet, Quicknode RPC) | passed, 110 checks |
| Shared unit tests (`pnpm --filter @thunai/shared test`) | 7 passed (contact rules, same person however typed, masking) |
| `pnpm agora:check` against the live pair | **ready**: the vault and the relayer are past the role gate (approved through Agora's testnet Whitelister), tokens and decimals pass |
| Landing page production build | compiled, `/` and `/traction` |
| Full live end-to-end through the deployed stack | `pnpm e2e:testnet` with the site's `/relayer` and `/agent` as the target: 110 checks passed, so Vercel proxying to the Render relayer and agent works for the whole scene |
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
| **The Chainlink CRE workflow on the CRE network** | Not deployed: that needs CRE Early Access approval. The simulation itself is verified (see above). CRE does not write onchain in our design. |
| **The notes key from a real passkey (PRF)** | The e2e uses a deterministic stand-in for the authenticator's PRF output, because a script cannot do WebAuthn PRF. The encryption, storage and read-back are real. `getPasskeyPrfOutput` with the `thunai/notes` salt is written and typechecks, but has not run on a phone. |
| **The Alchemy webhook, filtered to our vault** | Alchemy's deliveries reach the deployed agent: an unfiltered webhook delivered thousands of signed messages through the website, all accepted (signature checked) and the unrelated events skipped. The webhook filtered to the vault's `HoldOpened` and `SOSRaised` has not fired for the events our live tests created; the cause (the query's filter syntax, or Alchemy on Monad testnet) is not yet known. |
| **Web push delivery to a real browser** | Service worker, signed enrolment and the agent's send are built. No browser has received an alert. On iPhone it needs the app added to the Home Screen. |
| **Every Face ID flow on a physical phone** | Run in a desktop browser and in tests with software passkeys. Not yet on one Android and one iPhone. |
| **Silent SOS, the notes card, alerts card, session prompt and "How fast" card as screens** | They render and typecheck and the backend they call is tested, but nobody has tapped through them on a phone. |
| **The indexer's evidence line on a hold card, on a phone** | The query is accepted by the live indexer (`pnpm check:envio`), and the app reads it first. Not yet seen on a phone. |
| **The LLM explanation** | The Anthropic account has no credit, so every hold used the rules' own explanation. |
| **The ERC-8004 feedback from the app** | The relayer path is verified on testnet by the e2e. The app's background call after a stop (session signs the transaction) has not run on a phone. |

## Not done

| Thing | Why |
|---|---|
| **Cleanverse** | Blocked: `docs.cleanverse.com` is behind an invitation code, and the three CCP PDFs are not in `docs/vendor/` yet, so nothing was built. Drop them in (and the invitation code, if the site is needed) to resume Phase 7 with a 3-hour time box; if neither is available, drop Cleanverse. |
| **Aurora Intents** | **Skipped, by decision.** Aurora's docs list Monad as supported for source and destination but never mention a testnet, anywhere (checked the docs index and the Intents Connect, Deposits and Swap chain pages). Only a mainnet flow is documented, which would need real funds and our contracts on mainnet, so nothing was built and nothing was spent. If Aurora's team confirms testnet support, Phase 8 can be picked up with a 3-hour time box. |
| **A keep-alive monitor for the free Render service** | The relayer and agent run on Render's free plan at `https://companion-api-27cv.onrender.com`, which sleeps after 15 minutes without requests. Until a free pinger (UptimeRobot) hits `/health` every 5 minutes, the keeper is not guaranteed to run. No disk: display names, masked contacts, push subscriptions and pending invites are lost on a restart or redeploy. |
| **The repository shared with the organisers** | It is public at `github.com/SamuelDharshi/Companion`; share it with `metropolis@hackathon.monad.xyz` if it is made private. |
| **CRE video** | Yours to record; script in `docs/DEMO.md`. |
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
- Agora approval came from Agora's testnet self-service Whitelister (mainnet needs KYC). The swap sets no minimum output, fine at the testnet's 1:1 price, not on mainnet.
- Face ID works in the phone's browser, not inside Expo Go.
- It protects money held in the app, not the student's bank account. Silent SOS and Check on Arjun break the isolation instead.
- Parent alerts reach her by WhatsApp link and by opening the app. Browser push is built but not proven on a device.
- The AI explanation is optional. Fixed rules decide every hold, and a model can never move or release money.
- The Envio indexer is on Envio Cloud's free development plan. The vault-filtered Alchemy webhook has not fired yet (deliveries themselves are verified). Cleanverse and Aurora are not built.
