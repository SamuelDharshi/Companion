# COMPANION  ·  Thunai

**Scammers win by cutting you off from family. Companion makes family your second key, and every family's save protects the next.**

*Companion* (**Thunai** in Tamil, which means "companion") is a family money agent for Indian parents with a child studying abroad.

- **Every week**, it moves the allowance across borders in about a second (measured median 1.2 s on Monad testnet).
- **When something is wrong**, it pauses the money and pages Kavya before anything moves.

Built for **Monad Metropolis** · **Track: Consumer Products & Payments** · Monad Testnet (10143)

**Bounties:** Agora Cross-Border Payments · Mera "Best Mera-Powered UX" · Mera "One Passkey, Many Keys" · Best Community Team. See [`docs/SUBMISSION.md`](docs/SUBMISSION.md).

---

## The problem, in one scene

It is 11pm in Bloomington, Indiana. Arjun, an F-1 student from Chennai, gets a call from a
spoofed number. The caller says he is an ICE officer, quotes Arjun's real SEVIS details, and
tells him his visa is being revoked. He must pay a $2,000 "bond" now, and he **must not call
anyone** — "your phone is being monitored."

In Chennai it is 8:30am. Kavya is awake, making coffee. She has no idea.

That gap is the product. The scam works *only* if the family is kept apart. Companion makes the
family link automatic, so Arjun never has to "call someone" against orders — the money itself
goes to Kavya first.

**The evidence:** complaints of cyber fraud and extortion against Indians in the US rose from
**8 in 2024 to 613 in 2025** ([MEA data via Business Standard][mea]). **Shreya Bedi**, an
Indiana University student, was kept on the phone for three hours by fake ICE officers, told
not to contact anyone, and paid **$5,000 in gift cards** ([WION][wion]). **363,019 Indian
students** were in the US in 2024–25 ([Open Doors 2025][od]), and **$2.92B** in education
remittances left India under the LRS in FY25, mostly over SWIFT at 1–3 days ([Dataful][df]).

India's RBI proposed a "trusted person" rule for vulnerable customers in April 2026. That
proves the need — but it only works *inside one Indian bank*, and no bank serves both Chennai
and Indiana. Companion is the cross-border version, enforced by a neutral contract.

---

## What it does

The Companion agent runs continuously for each family. It never holds anyone's keys.
**The rules and the guardian decide; the agent executes, explains and connects.**

| | What it does | What the family sees |
|---|---|---|
| 1 | **Runs the allowance.** Kavya signs one envelope ("$150 every Sunday, rent on the 1st"). The agent settles it through Agora with nobody touching the app. | "The weekly allowance from Kavya arrived." |
| 2 | **Guards withdrawals.** Any new payee, unusual amount, or flagged handle opens a **cooling hold** onchain. | "Held for safety. We've asked Kavya." |
| 3 | **Reads the situation.** An LLM names the scam script and explains it in plain English. | "This looks like the *fake officer* scam." |
| 4 | **Breaks the isolation.** Pages Kavya at once, by web push and a WhatsApp deep link. | Kavya's phone buzzes. |
| 5 | **Fails safe.** If nobody answers, anyone can expire the hold and the money returns to Arjun. A keeper does it automatically. | "No one answered, so your money is back." |
| 6 | **Learns as a network.** A confirmed scam raises the hold level for every other family. | "Another family reported this number." |
| 7 | **Answers voice clones.** Kavya taps **Check on Arjun**; his phone answers with one passkey tap, verified onchain. | "Signed on Arjun's phone," with the real verification time. |
| 8 | **Silent SOS, for money outside the app.** One discreet tap pauses the student's in-app money, pages the parent and opens a private video call. It does not depend on how the scammer wants to be paid. | "Your family has been told. You can hang up." |

**Hard rule, enforced in code:** the LLM never moves or releases money. Holds come from
deterministic contract rules and are already open before the classifier runs. Releases need a
guardian's passkey, verified onchain.

---

## Why it needs Monad

The rescue has to finish **while the scammer is still on the line.**

- **Fast finality** and `eth_sendRawTransactionSync` give a receipt in the same call, so Arjun's
  hold and Kavya's Face ID cancel are each confirmed in about a second. There are no pending
  states in the UI.
- The **P256 precompile at `0x0100`** (EIP-7951) verifies **a passkey from another continent
  inside the contract**. No server, no company and no scammer can override Kavya. This is the
  load-bearing one: without it, the guardian layer would be a server check.
- **Agora Instant Settlement** is built to replace a 1–3 day SWIFT transfer with a swap that settles in the same transaction. It is switched off until Agora whitelists our vault (see Honest limits).

**Measured on live Monad testnet** (`pnpm e2e:testnet`, 19 confirmed transactions): median **1.23 s**, fastest 0.65 s, slowest 1.53 s. Raw numbers are in [`docs/e2e-testnet.json`](docs/e2e-testnet.json), and the landing page lists every transaction of a recorded run with a link. No other latency figure is quoted anywhere.

---

## Honest claims

The table we memorised, because judges should probe it.

| We say | We never say |
|---|---|
| "Money from home can't leave Companion in one phone call." | "Protects Arjun's bank account." It doesn't — gift cards bought on another card bypass Companion entirely. |
| "A hold Kavya can cancel. The money never left." | "Clawback." Nothing is ever pulled back from anyone. |
| "Proves it's really Arjun, on his own phone, right now." | "Proves Arjun is safe." A passkey can't be cloned; a person can be coerced. The duress key covers that. |
| "Network reports raise the hold level; they never block on their own. Payees on the family's signed schedule are immune." | "Blocks scammers network-wide." |
| "Hashed handles are pseudonymous." | "Private" or "anonymous." |
| "Funding from India would come through a licensed LRS partner; testnet uses a labelled stand-in." | Anything implying a resident Indian buys crypto. |
| "Rules decide, the AI explains." | "AI detects scams." |

**"Companion can't see Shreya's gift cards."** Right. But the hold pages Kavya. Once Arjun isn't
alone on that call, the gift-card demand fails too. **We break the isolation, not just the
payment.**

---

## Architecture

```
┌──────────── Companion app (Expo: one app, two roles) ─────────────┐
│ Mera: one passkey per person, three independent keys              │
│   thunai/acct    → secp256k1 account (signs withdraw intents)     │
│   notes vault    → encrypts the family question (Mera-managed)    │
│   thunai/duress  → secp256k1 freeze key, registered onchain       │
│ Custom WebAuthnClient → the SAME Face ID also yields a P256       │
│   assertion over our action hash, for onchain verification        │
└──────────────────────────────┬────────────────────────────────────┘
                               │ signed intents
                      ┌────────▼─────────┐  eth_sendRawTransactionSync
                      │ Relayer          │─────────────────────────┐
                      │ pays gas, holds  │                         │
                      │ no spending power│                         │
                      └──────────────────┘                         │
┌─────────────────────────────────────────┐   ┌───────────────────▼────┐
│ Companion agent (Node)                  │   │ ThunaiVault            │
│  allowance runner · keeper (expireHold) │──►│ (Monad testnet)        │
│  rules classifier (+ optional LLM)      │   │  envelopes · holds     │
│  pager: WhatsApp link (web push is not  │   │  guardian release      │
│         wired into the app yet)         │   │  WebAuthn → 0x0100     │
│  Silent SOS page and video-call link    │   │  liveness · duress     │
└─────────────────────────────────────────┘   │  freeze                │
                                              └───┬────────────────┬───┘
                                   ┌──────────────▼───┐   ┌────────▼────────────┐
                                   │ ScamSignals      │   │ Agora Instant       │
                                   │ passkey-signed   │   │ Settlement (swap    │
                                   │ reports          │   │ built, switched off)│
                                   └──────────────────┘   └─────────────────────┘
```

The app reads the contract and the relayer directly. There is no indexer in the running system.

| Folder | What's in it |
|---|---|
| [`contracts/`](contracts) | `ThunaiVault.sol`, `ScamSignals.sol`, 95 Foundry tests (including a fork test against the real Agora pair), deploy script |
| [`relayer/`](relayer) | Gas sponsorship, `eth_sendRawTransactionSync`, intent API |
| [`agent/`](agent) | Allowance runner, keeper, classifier, pager |
| [`indexer/`](indexer) | An Envio indexer (config, schema, handlers). **Included but not deployed.** |
| [`app/`](app) | Expo app — both roles, every screen |
| [`frontend/`](frontend) | The landing page (Next.js). Its numbers come from a recorded run on testnet. |
| [`packages/shared`](packages/shared) | Chain config, ABIs, action hashes, merkle trees, copy-safe money formatting |
| [`packages/evm`](packages/evm) | Vault bindings shared by relayer and agent |

**Who custodies what:** the family's money sits in `ThunaiVault`, accounted per family,
because escrow *is* the feature. No server key can move it. Outflows need Arjun's signature
plus contract rules, and anything held needs Kavya's passkey. *No company can move your money,
including us.*

---

## Running it

```bash
pnpm install
cp .env.example .env          # fill in: MONAD_RPC_URL, three private keys, and the access tokens
pnpm contracts:test           # 95 tests, real P256 assertions
pnpm contracts:deploy         # writes contracts/deployments/10143.json
pnpm dev                      # relayer + agent + app, with a readiness report
```

Then open the app, create as the student, send the WhatsApp invite to a second device, and
accept as the guardian.

### One permanent HTTPS domain (read this before creating any account)

A passkey is created for **one host** and works only there. If you open the app from a different host,
every account made on the old one is unreachable. So pick the host once and keep it: a **reserved ngrok
domain** or a **Vercel URL**, never a random one that changes. Passkeys need HTTPS (or `localhost`), and the
relayer and agent must be HTTPS too when the app is, or the browser blocks the calls.

The landing page and the app are **one site** (`/` and `/app`), and the site proxies the relayer and agent at
`/relayer` and `/agent`, so there is one host to keep:

```bash
pnpm web:dev          # exports the app into the site, then serves it on http://localhost:3000 (app at /app)
```

```
APP_URL=https://your-permanent-host/app
```

`pnpm dev` checks the URLs on startup and warns if the app origin is not HTTPS or localhost, or if the host is not local (a
reminder that it must never change). The app also says so on its first screen. [`docs/DEPLOY.md`](docs/DEPLOY.md) covers
tunnelling it for a phone test and deploying the same site on Render (`render.yaml`, not yet run on Render).

### Access control

The relayer and agent are reachable from the internet, so their sensitive routes are closed by default
(see `.env.example`, section 7b):

- `/fund`, and the agent's `/keeper/tick` and `/classify`, need `DEV_ADMIN_TOKEN` and **do not exist** without it.
- The agent's webhooks and the relayer's push-subscription list answer only a caller with `INTERNAL_TOKEN`.
- "Send money now" is signed by the guardian's own account key, and exists only when `TESTNET_PARTNER_STANDIN=true`.
- Subscribing a device to alerts needs a signature from that family member's own key.

Never put any token in an `EXPO_PUBLIC_` variable: it would ship to every device.

### Verifying it without a browser

```bash
pnpm e2e            # the whole rescue on a private local chain, 15 beats, real WebAuthn assertions
pnpm e2e:testnet    # the same scene on live Monad testnet, fresh random keys, records timings
pnpm parity         # proves the TypeScript and Solidity agree on every hash
pnpm agora:check    # asks the real Agora pair whether our vault may swap (read-only)
pnpm check:indexer  # checks the undeployed indexer files against the contract ABIs
```

`pnpm e2e` spins up Anvil, deploys, etches a P256 verifier where Monad has its precompile,
starts the relayer and agent, and plays the full scene: onboarding, allowance, rent paying
itself, a held payment, Kavya's cancel, the fail-safe expiry, the liveness check, the
network warning, Silent SOS, encrypted notes, the lock-down checks and push enrolment. It asserts the
payee receives nothing at any point. `pnpm e2e:testnet` adds ERC-8004 reputation and runs on the real chain.

### Judge instructions

Open on two devices. **Device 1:** create as the student → copy the invite link.
**Device 2:** open the link → accept as the guardian with one Face ID → sign the envelope.
Then send a small amount to a new address from Device 1 and watch Device 2.

Passkeys need a secure context, so use `https://` or `localhost`. See [`docs/DEMO.md`](docs/DEMO.md) for the tunnel and the second-device setup.

---

## Deployed addresses

`contracts/deployments/10143.json` is the source of truth. Monad testnet, chain 10143.

| Contract | Address |
|---|---|
| `ThunaiVault` (the app's vault) | `0x3aC3F87d6713390aCfeD85133Ca662d7a2ADCf87` |
| `ScamSignals` | `0xC0F7e94758975A33Bd7c1849be325734f20DA16e` |
| Stand-in CTK (testnet) | `0xCf73DA999EE8b7B6181a32Ab95aEFE44edA10acF` |
| Stand-in AUSD (testnet) | `0x93e068B5f92eB225A08b474f8C115C21B51520C6` |
| Agora-ready vault (real tokens, awaiting whitelist) | `0xF2BA20FaF5f171DcDB9E7F70a489855d170465C1` |
| Agora CTK/AUSD pair | `0x1Aa8958Aa34cEC8096EF4381cb335effe977b0ae` |
| ERC-8004 identity registry (agent **#2187**) | `0x8004A818BFB912233c491871b3d84c89A494BD9e` |
| P256 precompile | `0x0000000000000000000000000000000000000100` |

---

## Track and bounties

**Track: Consumer Products & Payments.** An end-user app for a student and a parent, with no crypto
word on their screens.

- [**Agora** — cross-border payments](docs/SUBMISSION.md#agora)
- [**Mera** — best Mera-powered UX](docs/SUBMISSION.md#mera-ux)
- [**Mera** — one passkey, many keys](docs/SUBMISSION.md#mera-many-keys)
- Best Community Team (selected on our hackathon profile)

Not entered: Envio (an indexer is included in `/indexer` but is not deployed; see
[`docs/ENVIO_DEPLOY.md`](docs/ENVIO_DEPLOY.md)), Cleanverse and Aurora. [`docs/STATUS.md`](docs/STATUS.md) lists exactly what
is verified, unverified and not done.

One finding worth reading in [`docs/SUBMISSION.md`](docs/SUBMISSION.md): how one Face ID is made to
serve both Mera's PRF and the contract's WebAuthn verification.

---

## Honest limits

Stated here rather than discovered by a judge.

- **Testnet only.** The tokens are labelled stand-ins with no real value.
- **The Agora swap is built but switched off.** It needs the `APPROVED_SWAPPER` role on our vault,
  which Agora has not granted. Until then the vault credits AUSD from a pre-funded float, the
  Details screen says so, and the vault refuses to credit AUSD it does not hold.
- **Face ID works in the phone's browser, not inside Expo Go.** React Native has no WebAuthn. The
  web build, installed to the home screen, is the mobile experience today.
- **PRF support varies.** On desktop Chrome only passkeys saved in Google Password Manager return PRF (Mera throws `PRF_UNAVAILABLE` otherwise).
- **Not yet proven on physical phones.** It has been run in a desktop browser and in automated tests
  with software passkeys. PRF support also varies: some low-end Android devices lack it, and the app
  says so on the first screen.
- **It protects money held in the app, not the student's bank account.** A gift card or a Zelle
  transfer never touches Companion. Silent SOS and Check on Arjun break the isolation instead.
- **Parent alerts:** a WhatsApp link and opening the app work. Browser push is built (service worker, signed
  enrolment, the agent's send) but no real browser has received one yet, and on iPhone the app must first be added
  to the Home Screen.
- **The AI explanation is optional.** Fixed rules decide every hold. A language model can write the
  explanation when an API key with credit is set, and it can never move money.
- **No indexer.** The Envio indexer is included but not deployed. The app's counters come from our relayer, which
  counts the contracts' own events, and the screens say so.
- **PRF notes key on a real phone is unverified.** The notes are encrypted and stored onchain and the round trip is
  tested, but with a stand-in for the authenticator's PRF output.
- **Nothing on the landing page is invented.** Every figure is from a recorded run with a transaction
  hash. The family in that run is fictional.

---

## Business model

Companion earns a small FX/transfer spread on each allowance — the same model remittance
companies use. The guardian layer is free, and it is why families stay.

[mea]: https://www.business-standard.com/immigration/75x-jump-in-scams-hits-indians-in-us-amid-visa-crackdown-govt-data-126040600784_1.html
[wion]: https://www.wionews.com/world/indian-student-in-us-becomes-victim-of-digital-arrest-scam-loses-5-000-to-scammers-posing-as-ice-officers-here-s-what-happened-1749373803522/amp
[od]: https://gradright.com/news/india-tops-open-doors-2025-international-students-usa/
[df]: https://insights.dataful.in/articles/travel-drives-indias-lrs-outflows-as-education-remittances-moderate
