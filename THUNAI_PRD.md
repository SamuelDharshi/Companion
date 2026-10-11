# THUNAI (துணை): Product Requirements Document

> **Scammers win by cutting you off from family. Thunai makes family your second key, and every family's save protects the next.**

*Thunai* (THOO-nai) is Tamil for companion or ally. It is a family money agent for Indian parents with a child studying abroad.
- **Every week**, it moves the allowance across borders instantly.
- **When something is wrong**, it pauses the money and makes sure Amma knows within seconds, before anything moves.

| | |
|---|---|
| **Hackathon** | Monad Metropolis |
| **Hard deadline** | Oct 14, 2026, 09:29 IST. **Internal deadline: submit by Oct 13, 20:00 IST.** |
| **Track** | Consumer Products & Payments ($30k, 3 × $10k) |
| **Bounties: must** | Agora "Best Cross-Border Payments App" ($10k) · Mera "Best Mera-Powered UX" ($2.5k) · Mera "One Passkey, Many Keys" ($2.5k) · Envio ($1k) · Best Community Team ($5k, if your campus group is on the onboarded list) |
| **Bounties: stretch** | ERC-8004 agent identity and reputation (no separate bounty; adds Monad-native depth) |
| **Do NOT add** | Dynamic or Privy. Mera must be the entire account layer, or both Mera bounties weaken. |
| **Network** | Monad Testnet (chain ID 10143) |

---

## 1. The use case

### 1.1 The story you open with
It's 11:00 pm in Bloomington, Indiana. Arjun, an F-1 student from Chennai, gets a call from a spoofed number. The caller says he is an ICE officer, quotes Arjun's SEVIS details, and tells him his visa is being revoked. He must pay a $2,000 "bond" now, and he **must not call anyone**: "your phone is being monitored."

In Chennai it is **8:30 am**. Amma is awake, making coffee. She has no idea.

That gap is the use case. The scam works only if the family is kept apart. Thunai makes the family link automatic. Arjun never has to "call someone" against orders, because the money itself goes to Amma first.

### 1.2 Evidence (cite these exact sources; use absolute numbers, not "77×")
- India's Ministry of External Affairs (MEA), in data presented to the Rajya Sabha, reported complaints of cyber fraud and extortion against Indians in the US rose from **8 in 2024 to 613 in 2025**. Victims are mostly F-1, H-1B and H-4 holders, and parents in India report **AI voice-clone "your child is arrested" calls**. ([Business Standard, Apr 6 2026](https://www.business-standard.com/immigration/75x-jump-in-scams-hits-indians-in-us-amid-visa-crackdown-govt-data-126040600784_1.html))
- **Shreya Bedi**, an Indiana University F-1 student, was kept on the phone for 3 hours by fake ICE officers, told not to contact anyone, and paid **$5,000 in gift cards** as "bond". ([WION](https://www.wionews.com/world/indian-student-in-us-becomes-victim-of-digital-arrest-scam-loses-5-000-to-scammers-posing-as-ice-officers-here-s-what-happened-1749373803522/amp))
- The FBI, USCIS and the Indian Embassy issued joint-style warnings in May 2025. ([The Logical Indian](https://thelogicalindian.com/scam-calls-target-f-1-visa-students-fbi-uscis-and-indian-embassy-issue-urgent-warning-heres-how-to-stay-safe/))
- **363,019 Indian students** were in the US in 2024–25, the largest source country. ([Open Doors 2025 via GradRight](https://gradright.com/news/india-tops-open-doors-2025-international-students-usa/))
- **$2.92B** in education remittances went out under India's Liberalised Remittance Scheme (LRS) in FY25, mostly over SWIFT, which takes 1–3 days and charges fees. ([Dataful](https://insights.dataful.in/articles/travel-drives-indias-lrs-outflows-as-education-remittances-moderate))

### 1.3 Who the user is
- **Buyer and protected party: Amma**, a parent in Tamil Nadu who sends money every month to a child doing an MS in the US. She feels both the cost (SWIFT fees, waiting) and the fear (news of scams, voice-clone calls).
- **Daily user: Arjun**, the student. He uses Thunai because the allowance arrives instantly and rent pays itself.
- **First community:**
  - LICET alumni now in US MS programs, and their parents in Chennai, reached through alumni WhatsApp groups.
  - Next, Tamil student associations and Indian Students Association (ISA) chapters at US universities.
- **Later expansion:** Telugu, Hindi and Malayalam families, then UK, Canada and Australia.

### 1.4 Why now
- Complaints went from 8 to 613 in one year, during a visa crackdown that makes the threats believable.
- AI voice clones now make "your son is arrested" calls convincing.
- The Fall 2026 cohort has just landed, and the first months abroad are the most dangerous.
- India's RBI proposed a "trusted person" rule for vulnerable customers in April 2026. That proves the need, but it only works **inside one Indian bank**. No bank serves both Chennai and Indiana. Thunai is the cross-border version, enforced by a neutral contract.

### 1.5 Why it needs Monad (say this in one breath)
The rescue has to finish **while the scammer is still on the line.**
- Monad's sub-second finality and `eth_sendRawTransactionSync` give instant receipts, so Arjun's hold, Amma's alert and Amma's Face ID cancel all land within seconds.
- Monad's P256 precompile verifies **a passkey from another continent inside the contract**, so no server, no company and no scammer can override Amma.
- Agora's Instant Settlement replaces a 1–3 day SWIFT transfer with a sub-second one.

---

## 2. What Thunai does (the agent is the product)

The **Thunai agent** runs continuously for each family. It never holds anyone's keys. **The rules and the guardian decide; the agent executes, explains and connects.** Say this on stage.

| # | Autonomous job | What the user sees |
|---|---|---|
| 1 | **Runs the allowance.** Amma signs a weekly envelope once ("$150 every Sunday, rent $900 on the 1st"). The agent executes it through Agora Instant Settlement with no one touching the app. | "Sunday $150 from Amma arrived · 0.8s". Rent: "Paid automatically". |
| 2 | **Guards withdrawals.** Any unscheduled withdrawal, new payee, unusual amount or network-flagged handle opens a **cooling hold** onchain. | Arjun: "Held for safety. We've asked Amma." |
| 3 | **Reads the situation.** An LLM classifies the scam script from Arjun's answer to "What's this for?", plus the amount, payee novelty, time of day and network signals. It labels the script (fake ICE/SEVIS, digital arrest, voice-clone arrest, job/task scam) and writes a short explanation in **Tamil and English**. | Amma: "This looks like the *fake officer* scam." |
| 4 | **Breaks the isolation.** It pages Amma instantly (web push, plus a WhatsApp deep link) and asks Arjun the family question Amma recorded. | Amma's phone buzzes. |
| 5 | **Fails safe.** If no one answers before the timeout (default 30 min), anyone can call `expireHold`, and the money goes back to Arjun's balance, never to the payee. A keeper bot calls it automatically. | "No one answered, so your money is back." |
| 6 | **Learns as a network.** When a family confirms a scam, the agent drafts a report: a salted hash of the destination handle plus the script ID. Amma signs it with Face ID, and every other family's agent **raises the hold level** on matching payments. | "1 verified family reported this number, 2 minutes ago." |
| 7 | **Answers voice clones.** When Amma gets a "your son is arrested" call, she taps **Check on Arjun**. Arjun's phone asks for one passkey tap, the contract verifies it, and Amma sees the proof. While the check is unanswered, the agent holds any payment from Amma to a new payee. | "Signed on Arjun's phone, 0.9s ago." |

**Hard rule: the LLM never moves or releases money.** It only classifies and explains. Holds come from deterministic contract rules. Releases need a guardian's passkey verified onchain.

---

## 3. Honest claims (memorise these; judges will probe)

| Say | Never say |
|---|---|
| "Money from home can't leave Thunai in one phone call." | "Protects Arjun's bank account." It doesn't; gift cards bought on another card bypass Thunai. |
| "A hold that Amma can cancel. The money never left." | "Claw back." |
| "Proves it's really Arjun, on his own phone, right now. A voice can be cloned; a passkey can't." | "Proves Arjun is safe." The duress key covers coercion. |
| "Network reports raise the hold level; they never block on their own. Payees on the family's signed schedule are immune." | "Blocks scammers network-wide." |
| "Hashed handles are pseudonymous." | "Private / anonymous." |
| "Funding from India would come through a licensed LRS partner; testnet uses a labelled stand-in." | Anything implying a resident Indian buys crypto. |
| "Rules decide, the AI explains." | "AI detects scams." |

**Answer to "Thunai can't see Shreya's gift cards":** "Right. But the hold pages Amma. Once Arjun isn't alone on that call, the gift-card demand fails too. We break the isolation, not just the payment."

---

## 4. UX: the architecture is the family

### 4.1 Principles
1. **One app, two roles.** The role is set at invite time. Amma's version is deliberately tiny.
2. **Arjun sets up; Amma only accepts.** Arjun invites Amma by WhatsApp; Amma opens a Tamil page and does **one Face ID**. Nothing else.
3. **No crypto words, ever:** no AUSD, gas, wallet, address, hash or token on screen. Say "$", "allowance", "Held for safety", "Amma approved". Payees are names. Proofs hide under "Details".
4. **No pending states.** Every action gets its result back instantly.
5. **Purple means family-verified.** Monad purple appears only where a passkey acts: approvals, the Thunai seal, "Signed by…".

### 4.2 Visual system (warm light theme built from Monad's brand kit)

| Token | Value | Use |
|---|---|---|
| `--bg` | cream with a 15% tint of `#DDD7FE` | App background |
| `--ink` | `#0E091C` | Text |
| `--trust` | `#6E54FF` | **Only** for guardian or passkey moments, the Thunai mark and "Signed by" seals |
| `--arrived` | `#85E6FF` | Money arrived |
| `--held` | `#FFAE45` | Held for safety |
| `--scam` | `#FF8EE4` | Confirmed scam (soft, never alarm red) |
| Dark mode | `#0E091C` base | Supported, not default |

- **Type:** Britti Sans for headings and large amounts (fall back to a geometric sans if unlicensed). Inter for UI text. **Noto Sans Tamil** for Amma's strings. Roboto Mono only for proof details ("signed 0.9s ago", receipt number).
- **Shape:** 20px rounded cards, real family photos as avatars.
- **Signature motif: the thread.** A thin purple line joins Arjun's and Amma's avatars on every screen. It **pulses** whenever the guardian acts. This is the brand: the family link, made visible.
- Check monad.xyz/brand-and-media-kit before finalising.

### 4.3 Arjun's screens

| Screen | Components |
|---|---|
| **Onboard** | "Create with Face ID" (one passkey ceremony), then "Invite Amma as your Thunai" with a WhatsApp share button. |
| **Home** | Balance ("$1,240"), "Next from Amma: Sun $150", rent chip ("Auto-pays Nov 1"), guardian strip with Amma's photo: "Amma is your Thunai", activity feed. |
| **Send** | Payee, amount, and a required **"What's this for?"** field, which feeds the classifier. |
| **Hold** | See microcopy below. |
| **Family question** | The pre-agreed question Amma set, decrypted from `thunai/notes`. |
| **Check request** | "Amma is checking on you. Tap Face ID to show it's really you." Plus a hidden duress option (alternate gesture). |
| **Details** | Receipt number, latency, block, and an explorer link for the curious. |

**Hold screen microcopy**
> **Held for safety: $2,000**
> This is a new payee and an urgent request. We've asked Amma.
> *Real officers never ask for payment by phone, gift card or crypto.*
> [ Amma is reviewing… ⏳ 29:41 ]
> If no one answers, your money comes back automatically.
> *Details: 1 family reported this number.*

### 4.4 Amma's screens (Tamil first, English toggle)

| Screen | Components |
|---|---|
| **Accept invite** | "அர்ஜுன் உங்களை அவனுடைய துணையாக அழைக்கிறான். Arjun wants you as his Thunai." One button: Face ID. |
| **Home** | Big status pill **"எல்லாம் நலம் · All good"**, last allowance sent, a large purple **"அர்ஜுனை சரிபார் · Check on Arjun"** button, and "Send money now". |
| **Alert** | See microcopy below. |
| **Check result** | See microcopy below. |
| **Envelope** (once, at setup) | "Every Sunday $150 · Rent $900 on the 1st · Ask me before anything new". One Face ID. |

**Amma's alert microcopy (push notification and full screen)**
> **அர்ஜுனுக்கு உங்கள் உதவி தேவை · Arjun needs you**
> Arjun is trying to send **$2,000** to a new person for "immigration bond".
> This looks like the *fake officer* scam. Arjun has been on a call for 40 minutes.
> [ நிறுத்து · Stop it (Face ID) ]  [ அனுமதி · Allow ]
> *Not sure? Stop it. Arjun gets his money back.*

**Check result microcopy**
> **✓ அர்ஜுனின் போனில் கையொப்பம் · Signed on Arjun's phone, 0.9s ago**
> This proves it's really Arjun's phone in his hands. A voice on a call can't fake this.
> *It doesn't prove he's safe. Call him on video too.*
>
> If there's no reply after 2 minutes: "No reply yet. Any payment from you to someone new will be held."

Have a native Tamil speaker proofread all strings, and use their natural phrasing.

### 4.5 Demo-only screen
A **second family phone** ("Priya's mother, Coimbatore") to show the network hold.

---

## 5. System architecture

```
 ┌──────────── Thunai PWA / mobile (one app, two roles) ────────────┐
 │ Mera: one passkey per person                                      │
 │   thunai/acct   → secp256k1 account (Mera signing session)        │
 │   thunai/notes  → secret vault: family question, hold evidence    │
 │   thunai/duress → secp256k1 freeze key (registered onchain)       │
 │ Custom WebAuthnClient → same Face ID also yields a P256 assertion │
 │   (challenge = actionHash) for onchain verification at 0x0100     │
 └──────┬───────────────────────────────────────┬────────────────────┘
        │ signed intents                         │ GraphQL live
 ┌──────▼──────────┐  eth_sendRawTransactionSync  ┌▼───────────────────┐
 │ Relayer (pays    │────────────────────────────►│ Envio HyperIndex    │
 │ gas, holds no    │                              │ feed, holds, checks,│
 │ spending power)  │      ┌──────────────────────┤ network signals     │
 └──────┬──────────┘      │ events                └─────────────────────┘
        ▼                  │
 ┌─────────────────────────┴────────────────┐   ┌───────────────────────┐
 │ ThunaiVault (Monad testnet)               │──►│ Agora Instant          │
 │  envelopes · holds · guardian release     │   │ Settlement pair        │
 │  WebAuthn verify → P256 precompile 0x0100 │   │ CTK→AUSD (testnet)     │
 │  liveness proofs · duress freeze          │   └───────────────────────┘
 │  reads ScamSignals.flagged()              │   ┌───────────────────────┐
 └───────────────────────────────────────────┘◄─►│ ScamSignals            │
 ┌───────────────────────────────────────────┐   │ passkey-signed reports │
 │ Thunai agent service (Node)               │   └───────────────────────┘
 │  allowance runner · keeper (expireHold)   │
 │  LLM script classifier + Tamil/English    │
 │  pager (web push / WhatsApp deep link)    │
 └───────────────────────────────────────────┘
```

### 5.1 Components

| Component | Tech | Responsibility |
|---|---|---|
| `ThunaiVault.sol` | Solidity, Foundry, Solady `WebAuthn` | Family registry, envelope, per-family balances, holds, guardian release, expiry, liveness, duress freeze, Agora swap call |
| `ScamSignals.sol` | Solidity | Passkey-signed reports tied to cancelled holds; `flagged()` view |
| App | Vite + React PWA (mobile-first, 390px); React Native only if spikes pass | Both roles, onboarding, all screens |
| Relayer | Node + viem | Submits signed intents with `eth_sendRawTransactionSync`; pays MON gas |
| Agent service | Node | Allowance cron, keeper, classifier (LLM with JSON schema output), pager |
| Indexer | Envio HyperIndex | Live feed, holds, checks, network counts, traction metrics |

---

## 6. Smart contracts

### 6.1 ThunaiVault: minimal surface

| Function | Who calls | Behaviour |
|---|---|---|
| `registerFamily(guardianX, guardianY, studentX, studentY, studentAcct, duressAddr)` | relayer (at onboarding) | Stores both passkey P256 public keys, Arjun's `thunai/acct` address and the `thunai/duress` address. |
| `setEnvelope(Envelope e, WebAuthnAuth a)` | relayer, with Amma's assertion | Verifies Amma's assertion over `hash(e)` at 0x0100. The envelope holds weekly amount, cadence, scheduled payees root, per-withdrawal cap, hold timeout and expiry. |
| `fund(familyId, amount)` | Amma's account | One-off "Send money now", settled through Agora (see §8). |
| `runAllowance(familyId)` | agent role (keyless keeper) | If due, swaps through the Agora pair and credits Arjun's balance. Emits `Payout`. |
| `withdraw(familyId, to, amount, memoHash, sig)` | relayer, with Arjun's `thunai/acct` signature | Pays at once if `to` is a scheduled payee within cap. Otherwise **opens a hold**: funds move to escrow, and `HoldOpened(id, reason, releaseAt)` is emitted. Also holds if `ScamSignals.flagged(hash(to))`. |
| `resolveHold(id, bool release, WebAuthnAuth a)` | relayer, with Amma's assertion | Verifies Amma's assertion over `keccak(id, release)` at 0x0100. Release pays the payee; cancel returns funds to Arjun's balance. |
| `expireHold(id)` | anyone, after `releaseAt` | Returns funds to Arjun's balance. **Fail-safe default.** |
| `proveLiveness(familyId, nonce, WebAuthnAuth a)` | relayer, with Arjun's assertion | Verifies Arjun's assertion over the nonce Amma's check created. Emits `LivenessProved(familyId, nonce, timestamp)`. |
| `requestCheck(familyId, nonce)` | Amma | Emits `CheckRequested`. Until it is answered, payments from Amma to new payees are held. |
| `freeze(familyId, sig)` | anyone, with a signature from the `thunai/duress` key | Freezes all outflows. Only Amma's passkey unfreezes. |

**Reason codes for holds:** `NEW_PAYEE`, `OVER_CAP`, `UNSCHEDULED`, `NETWORK_FLAG`, `CHECK_PENDING`, `FROZEN`.

**Events:** `FamilyRegistered`, `EnvelopeSet`, `Payout`, `HoldOpened`, `HoldResolved`, `HoldExpired`, `CheckRequested`, `LivenessProved`, `Frozen`, `Unfrozen`.

**Who custodies what:** the family's money-from-home balance sits in `ThunaiVault`, accounted per family, because escrow is the feature. No server key can move it. Outflows need Arjun's signature and contract rules, plus Amma's passkey for anything held. Say "no company can move your money, including us."

### 6.2 ScamSignals

| Function | Behaviour |
|---|---|
| `report(handleHash, scriptId, holdId, WebAuthnAuth a)` | Accepted only if `holdId` was **cancelled by that family's guardian**. Amma's assertion over the report is verified at 0x0100, so one report needs one real family's Face ID. |
| `flagged(handleHash) → (count, lastAt)` | View used by `withdraw`. |
| `rebut(handleHash, uri)` | The flagged party can append a response. |

**Anti-poisoning rules:**
- A flag only **raises the hold level**; it never refuses on its own.
- Payees on a family's signed schedule are immune.
- Reports need a cancelled hold.

### 6.3 WebAuthn onchain
- Use Solady `WebAuthn.verify(challenge, requireUV=true, auth, x, y)`. Its P256 library calls the precompile at **`0x0100`** (EIP-7951, 6,900 gas) on Monad. ([Monad precompiles](https://docs.monad.xyz/developer-essentials/precompiles))
- The challenge is always an action hash that includes chainId, vault address, familyId and a nonce, to prevent replay.
- Capture each passkey's **P256 public key at registration** from the attestation (`getPublicKey()` returns SPKI; extract x and y).

---

## 7. Mera integration (account layer and both Mera bounties)

**Read these in order:**
1. [Getting started](https://mera.category.xyz/getting-started/)
2. [Passkeys & PRF](https://mera.category.xyz/concepts/passkeys-and-prf/)
3. [Create passkey accounts](https://mera.category.xyz/recipes/create-passkey-accounts/)
4. [Signing sessions](https://mera.category.xyz/concepts/signing-sessions/)
5. [Send a transaction with viem](https://mera.category.xyz/recipes/send-a-transaction-with-viem/)
6. [Secret vaults](https://mera.category.xyz/concepts/secret-vaults/)
7. [Reference](https://mera.category.xyz/reference/)
8. [React Native recipe](https://mera.category.xyz/recipes/use-mera-with-react-native/) (only if going native)

Source: [github.com/category-labs/mera](https://github.com/category-labs/mera)

**APIs you'll use:**
- `createPasskeyWithPrfOutput` and `getPasskeyPrfOutput` (the PRF salt must be exactly 32 bytes; derive each salt as `keccak256("thunai/acct")` and so on)
- `createSecp256k1SigningSession` + `toViemAccount` (from `@category-labs/mera/viem`)
- `createSecretVaultWithExistingPasskey` / `decryptSecretVaultWithPasskey` / `parseSecretVault`
- `getEvmAddress`
- `WebAuthnClient`

**Key finding:** Mera returns PRF output, not the raw WebAuthn assertion or the passkey's P256 public key. To verify onchain at 0x0100, write a **custom `WebAuthnClient`** that wraps `navigator.credentials`:
- **At create:** store the attestation's P256 public key.
- **At get:** set the challenge to the action hash, and keep `authenticatorData`, `clientDataJSON` and the signature.

The same Face ID then gives Mera its PRF output **and** the contract its assertion. **Day-0 spike:** confirm Mera passes your client through and doesn't overwrite the challenge. If it does, fall back to `@simplewebauthn/browser` for guardian actions (a second prompt only on approvals; acceptable).

**Namespaces (salts)**

| Salt | Derived | Non-account work? | Purpose |
|---|---|---|---|
| `thunai/acct` | secp256k1 | No (account) | Arjun's and Amma's accounts; signing intents |
| `thunai/notes` | secret-vault key | **Yes: encryption** | Family question, hold evidence, Amma's voice notes. Decrypts only on family devices. |
| `thunai/duress` | secp256k1 | **Yes: capability key** | Registered onchain as the freeze authority, with no funds. The alternate gesture signs `freeze`. |

**Mera UX bounty checklist**
- [ ] One passkey ceremony at onboarding for each person. No seed phrase, no extension, no email or OTP.
- [ ] **Scoped prompt-free signing:** after Face ID, a 15-minute `thunai/acct` signing session signs routine intents (sending to scheduled payees, answering the family question) without re-prompting. **Re-prompt** for guardian actions, envelope changes and unfreeze. Show "Session active · 14 min" in Details, and handle expiry with "Tap Face ID to continue".
- [ ] **Stateless test, live:** clear storage, or open on a fresh device. One Face ID restores the same addresses, decrypts the family notes, and reads holds and envelope from chain. Nothing is kept on any server except untrusted public data.
- [ ] **Stack bonus:** gas sponsorship (relayer), onchain passkey verification (0x0100), Agora settlement.

**Many Keys bounty checklist**
- [ ] `thunai/notes` encrypts state, and `thunai/duress` is a capability key. Both are live in the demo.
- [ ] Salts are distinct namespaces. No key, PRF output or plaintext is persisted.
- [ ] **Cross-device test, live:** a second device derives the same duress address and decrypts the same family question.

---

## 8. Agora integration ($10k)

**What exists on Monad testnet** ([deployments](https://docs.agora.finance/instant-settlement/protocol-deployments.md)):

| Contract | Address |
|---|---|
| Instant Settlement **Factory** | `0x8468587Af422ad440F58a57E955eCA6A970b5375` |
| **CTK/AUSD pair** | `0x1Aa8958Aa34cEC8096EF4381cb335effe977b0ae` |
| Whitelister | `0x7c10F56d6f04a51376393a1C3670e966863F6BD5` |

The pair exposes fixed-price swaps: `swapExactTokensForTokens` and `swapTokensForExactTokens`, gated by an **`APPROVED_SWAPPER`** role. It also has `getPrice()` / `getPriceNormalized()`. ([Stable swap contracts](https://docs.agora.finance/stable-swaps/smart-contracts) · [Quick start](https://docs.agora.finance/instant-settlement/guides/quick-start.md) · [Testnet tokens](https://docs.agora.finance/instant-settlement/guides/getting-testnet-tokens.md) · [Examples](https://github.com/agora-finance/stable-swap-examples/tree/monad/src))

**The flow:**
1. Amma's balance arrives as **CTK**, the testnet stand-in for dollars bought through a licensed LRS partner.
2. The agent's `runAllowance` (or Amma's "Send money now") calls the pair to swap **CTK → AUSD at a fixed price**.
3. AUSD is credited to Arjun's balance in the same transaction.
4. Arjun sees "Sunday $150 from Amma arrived · 0.8s", next to a "SWIFT: 2–3 business days" comparison card.

This matches the bounty: a **mobile** app, **Mera passkey onboarding**, a visible **AUSD balance**, and a completed **send/receive settled instantly** through Instant Settlement.

**Day-0 actions (do these first):**
1. Read the Whitelister ABI on [testnet.monadvision.com](https://testnet.monadvision.com) and look for a self-serve function.
2. Ask in the Agora bounty channel to whitelist the `ThunaiVault` and relayer addresses as `APPROVED_SWAPPER`, and ask for testnet CTK/AUSD.
3. **If there's no whitelist by Oct 11, 18:00:** put the swap behind a flag, fund the vault with AUSD directly, and say so in the write-up. Keep asking.

**Business viability line (judged):** Thunai earns a small FX/transfer spread on each allowance, the same model remittance companies use. The guardian layer is free, and it is why families stay.

---

## 9. Envio (indexer)

Monad testnet is supported in HyperIndex, HyperSync and HyperRPC. ([Envio Monad testnet](https://envio.dev/chains/monad-testnet) · [HyperIndex docs](https://docs.envio.dev/docs/HyperIndex/overview) · [AI quickstart](https://docs.envio.dev/docs/HyperIndex/quickstart-with-ai))

- **`config.yaml`:** network 10143, contracts `ThunaiVault` and `ScamSignals`, all events above.
- **`schema.graphql`** (use derived entities, which the judges reward):

```graphql
type Family { id: ID!, student: String!, createdAt: BigInt!, balance: BigInt!, holds: [Hold!]! @derivedFrom(field: "family"), payouts: [Payout!]! @derivedFrom(field: "family"), checks: [Check!]! @derivedFrom(field: "family") }
type Payout { id: ID!, family: Family!, amount: BigInt!, viaAgora: Boolean!, timestamp: BigInt! }
type Hold { id: ID!, family: Family!, amount: BigInt!, reason: String!, scriptId: Int, status: String!, openedAt: BigInt!, resolvedAt: BigInt, secondsToResolve: Int }
type Check { id: ID!, family: Family!, requestedAt: BigInt!, provedAt: BigInt, latencyMs: Int }
type Signal { id: ID!, handleHash: String!, reports: Int!, lastAt: BigInt!, scriptId: Int! }
type NetworkStats { id: ID!, families: Int!, holdsOpened: Int!, scamsStopped: Int!, dollarsProtected: BigInt!, medianSaveSeconds: Int! }
```

- **Powers:** both feeds, Amma's alert trigger, the network evidence on hold cards, and a public **"Families protected"** counter for traction.

---

## 10. ERC-8004 (stretch, only if Day 3 morning is free)
- Register the **Thunai agent** in the Identity registry, owned by the team account, not by the vault.
- After a resolved hold, the family's account (a client, never the owner) gives feedback in the Reputation registry ("stopped $2,000 fake-ICE request").
- **Testnet:**
  - Identity `0x8004A818BFB912233c491871b3d84c89A494BD9e`
  - Reputation `0x8004B663056A597Dffe9eCcC1965A193B7388713`
  - Source: [QuickNode ERC-8004 contracts](https://erc-8004.quicknode.com/docs/contracts)
- Don't put scam handles in ERC-8004. Handles aren't agents, and a Monad engineer will notice.

---

## 11. Agent service details

**Classifier prompt contract** (LLM, JSON-schema output):
- **Input:** memo text, amount relative to the usual, payee-new flag, local hour, network flag count, call-duration hint if Arjun shares it.
- **Output:** `{ scriptId, confidence, explanation_en, explanation_ta, familyQuestionSuggested }`
- **Script IDs:** `1 FAKE_IMMIGRATION_OFFICER`, `2 DIGITAL_ARREST`, `3 VOICE_CLONE_ARREST`, `4 JOB_TASK`, `5 INVESTMENT`, `0 UNKNOWN`
- The output **only labels and explains**. Holds are opened by contract rules before the LLM even runs.

**Pager:** Web Push (PWA) plus a pre-filled WhatsApp deep link, "Arjun needs you on Thunai", as backup. Use text-to-speech for the Tamil voice note: browser TTS first, a cloud Tamil voice only if time allows.

**Keeper:** every 60s it calls `runAllowance` for due families and `expireHold` for timed-out holds. It holds MON for gas only.

---

## 12. Demo video (≤ 3:00, live product only)

| Time | Beat | On screen |
|---|---|---|
| 0:00 | **Open on Amma** | Her phone shows "Arjun needs you". Then rewind: "Ten seconds earlier, in Indiana…" |
| 0:10 | Problem | 8 → 613 complaints. Shreya's words: "kept me on the phone for three hours… I couldn't call anyone." |
| 0:25 | Setup | Arjun: Face ID → Invite Amma → WhatsApp → Amma's phone opens in Tamil → Face ID. Two real phones. |
| 0:50 | Daily autopilot | Sunday $150 lands from Chennai in about 1s via Agora, next to the "SWIFT: 2–3 days" card. Rent marked auto-pay. |
| 1:10 | **Main woah** | A teammate on speaker plays the "ICE officer". Arjun sends a $2,000 "bond". **Held for safety** appears instantly → Amma's phone buzzes with the Tamil alert → **Stop it** → Face ID → "Amma stopped this. $2,000 is back." Under 10 seconds, and Arjun never "called anyone". |
| 1:50 | Woah 2 | Play a cloned voice: "Amma, I've been arrested." Amma taps **Check on Arjun** → "Signed on Arjun's phone, 0.9s ago." Line: "A voice can be cloned. A passkey can't." |
| 2:15 | Woah 3 | Family B's phone tries to pay the same handle: held, "1 verified family reported this, 2 min ago." |
| 2:30 | Stateless | Clear Amma's browser storage (or open a fresh device) → Face ID → everything is back. |
| 2:45 | Close | Under the hood in one line (Monad · passkey verified onchain · Agora instant settlement), then the "families protected" count. "Thunai: family is your second key." |

**Pitch video (≤ 2:00):**
1. **Team** (10s): LICET, Chennai. "Our seniors are Arjun."
2. **Problem** (25s)
3. **Insight** (15s): isolation is the weapon, so make family the second key.
4. **Product** (30s): weekly allowance plus guardian on demand.
5. **Why new / why Monad** (20s): the RBI's idea works inside one bank; Thunai works across borders with instant finality.
6. **Traction and next** (20s)

---

## 13. Build plan (team of 2–4; adjust roles)

Roles: **C** = contracts, **F** = frontend + Mera, **A** = agent + relayer + Envio, **D** = design + traction + video.

| When | Work |
|---|---|
| **Sat Oct 11, 09:00–13:00: spikes** | **F:** custom WebAuthnClient + PRF on the team's real iPhone and Android. **C:** Solady WebAuthn verifying at 0x0100 on testnet. **A:** Agora whitelist + testnet tokens request; Envio scaffold; check that `eth_sendRawTransactionSync` works on the testnet RPC. **D:** screens in the theme; message alumni families. |
| **13:00 go/no-go** | If the 0x0100 verify fails, verify assertions in the relayer and store hashes onchain, and say so honestly (a big downgrade, so push hard on the spike). |
| **Sat 13:00–24:00** | **C:** ThunaiVault + ScamSignals deployed. **F:** onboarding for both roles, invite link, 3 salts, stateless restore. **A:** relayer, allowance runner + keeper, Envio indexer. |
| **Sun Oct 12** | **C:** holds, expiry, liveness, freeze, Foundry tests per reason code. **F:** hold screen, Amma alert, Check on Arjun, Tamil strings. **A:** classifier, pager. **D:** book 5–10 family drills. **22:00:** full run on two real phones. |
| **Mon Oct 13** | **AM:** network flow, feed polish, Agora swap (or fallback). **PM:** record family drills (traction), demo + pitch videos, README, logo. **20:00: submit.** |

**Cut order (cut from the top first):**
1. ERC-8004
2. React Native (ship the PWA; it still runs on phones)
3. Cloud Tamil voice (use browser TTS)
4. Mock off-ramp/rent sweep (show as a scheduled payee only)
5. Agora swap (fall back to direct AUSD transfer)
6. Duress freeze UI (keep key derivation for Many Keys)

**Never cut:**
- envelope
- hold
- guardian release verified at 0x0100
- auto-expiry
- Check on Arjun
- stateless restore
- network hold
- Envio feed

---

## 14. Traction plan (20% of the score)
- **Today:** post in LICET alumni WhatsApp groups: "Seniors doing MS in the US, try Thunai with your parents. 5 minutes, testnet, no real money."
- **Target by Oct 13:** **5–10 real parent–student pairs** onboarded, each running a 2-minute "scam drill" (the student sends a test "bond", the parent stops it). Record the median save time from Envio.
- **Collect:** one quote from a real parent (in Tamil, subtitled) and one from a student.
- Put the numbers on a public **"Families protected"** counter, and include them in the write-up.
- **Next 100 users:** Tamil student associations and ISA chapters at 3 named US universities, plus orientation sessions for outgoing students at Chennai colleges.
- **Roadmap:** licensed LRS partner for real funding → mainnet → Telugu/Hindi → UK/Canada.

---

## 15. Submission checklist
- [ ] Project created; track **Consumer Products & Payments**; bounties selected; **campus community selected on your profile**.
- [ ] Logo (PNG/WEBP, < 3MB): purple thread joining two dots.
- [ ] Public repo, shared with `metropolis@hackathon.monad.xyz`. Folders `/contracts`, `/app`, `/agent`, `/indexer`, plus a README with deployed addresses and the "honest claims" table.
- [ ] Demo video ≤ 3 min; pitch video ≤ 2 min.
- [ ] **Agora:** separate ≤ 2 min video showing passkey onboarding → AUSD balance → instant send/receive. Write-up on core features.
- [ ] **Mera UX:** write-up + video showing one ceremony, scoped session, stateless test.
- [ ] **Many Keys:** namespace table + cross-device test video.
- [ ] **Envio:** `config.yaml`, `schema.graphql`, handlers in the repo; describe the data driving holds and alerts.
- [ ] **Community:** the group name your team represents.
- [ ] Live link + judge instructions: "Open on two devices. Device 1: Create as student → copy invite link → open on Device 2 as guardian. Pre-funded test balance included." Provide a pre-made demo family as a fallback.

## 16. Risks

| Risk | Mitigation |
|---|---|
| Mera doesn't accept a custom WebAuthnClient challenge | `@simplewebauthn/browser` for guardian actions (second prompt only there) |
| PRF unsupported on a parent's low-end Android | Test on real devices Day 0; state supported devices; demo on known-good phones |
| No Agora whitelist | Direct AUSD transfer behind a flag; disclose; keep asking |
| `eth_sendRawTransactionSync` missing on RPC | Try other RPC providers; fall back to fast polling; drop exact latency claims |
| Judge: "can't stop gift cards" | Honest scope + "we break the isolation" answer |
| Judge: "regulatory?" | Licensed LRS partner on the India side; testnet stand-in; no resident crypto purchase |
| Network poisoning | Reports require a cancelled hold + guardian passkey; flags only escalate; scheduled payees immune; rebuttal |
| Elderly UX | Arjun sets up, Amma does one Face ID; three states only; Tamil first |

## 17. Reference links
- Monad: [getting started](https://docs.monad.xyz/developer-essentials/getting-started) · [precompiles](https://docs.monad.xyz/developer-essentials/precompiles) · [developer portal](https://developers.monad.xyz/) · [Metropolis resources](https://hackathon.monad.xyz/resources) · [faucet](https://faucet.monad.xyz/) · [brand kit](https://monad.xyz/brand-and-media-kit)
- `eth_sendRawTransactionSync` on Monad: [QuickNode](https://www.quicknode.com/docs/monad/eth_sendRawTransactionSync)
- Mera: [docs](https://mera.category.xyz/) · [GitHub](https://github.com/category-labs/mera)
- Agora: [contracts](https://docs.agora.finance/contract-overview) · [API](https://docs.agora.finance/api) · [deployments](https://docs.agora.finance/instant-settlement/protocol-deployments.md) · [examples](https://github.com/agora-finance/stable-swap-examples/tree/monad/src)
- Envio: [HyperIndex](https://docs.envio.dev/docs/HyperIndex/overview) · [Monad testnet](https://envio.dev/chains/monad-testnet) · [API token](https://envio.dev/app/api-tokens)
- Solady WebAuthn: [github.com/Vectorized/solady](https://github.com/Vectorized/solady) (`src/utils/WebAuthn.sol`)
- ERC-8004: [spec](https://eips.ethereum.org/EIPS/eip-8004) · [contracts](https://erc-8004.quicknode.com/docs/contracts)
- RBI proposal context: [Outlook Business](https://www.outlookbusiness.com/economy-and-policy/rbi-proposes-1-hour-delay-for-transactions-above-10000-to-fight-digital-fraud)
