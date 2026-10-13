# Submission: Companion

**Track: Consumer Products & Payments** (one track only).

**Bounties**

| # | Bounty | Status |
|---|---|---|
| 1 | [Agora, Best Cross-Border Payments App](#agora) | Entered. **Live:** every allowance and deposit settles through Agora's real CTK/AUSD pair on Monad testnet. |
| 2 | [Mera, Best Mera-Powered UX](#mera-ux) | Entered. |
| 3 | [Mera, One Passkey, Many Keys](#mera-many-keys) | Entered. |
| 4 | [Best Community Team](#best-community-team) | **Only if our campus group is in the portal's list of onboarded communities.** Group: **[YOUR CAMPUS GROUP]**. If it is not listed, we do not enter. |
| 5 | [Envio, Best Use of Envio](#envio) | Entered. HyperIndex 3 deployed on Envio Cloud, synced to the chain head, and read by the app. |
| 6 | [Chainlink, Best workflow with CRE](#chainlink-cre) | Entered. `cre workflow simulate` passes against the live chain. Not deployed to the CRE network. |
| 7 | [Alchemy, Best Projects using Alchemy](#alchemy) | Entered. Failover RPC live and verified; webhook deliveries reach the deployed agent; the vault-filtered webhook has not fired yet. |

Not entered: Dynamic and Privy (they would replace Mera as the account layer), Cleanverse (a Trust-track bounty), Nansen
(no data for testnet addresses), Aurora (needs mainnet funds), Kuru, Perpl, Agora Trading and MetaMask (trading
products), Hunyuan (Social track).

Every claim here matches [`docs/STATUS.md`](STATUS.md), which lists what is verified on testnet, what is built but
unverified, and what is not done. Where something does not work the way a bounty might expect, this document says so.

> **Companion makes family a student's second key.** Scammers win by cutting a student off from their family.
> Companion moves the allowance across the border in about a second, and when something looks wrong it
> pauses the money and tells the parent before anything leaves.

## The pitch

Companion is a family money agent for Indian parents with a child studying abroad. Every week it moves the allowance across
borders in about a second. When something is wrong, it pauses the money and pages the parent before anything moves.

A parent signs one weekly envelope with a single Face ID. After that the allowance runs by itself. Any payment to a new
person, an unusual amount or a reported payee is held inside the contract, and the parent's phone is paged. She stops or
allows it with her own Face ID, which the contract verifies itself on Monad's P256 precompile, so no server and no scammer
can override her. If nobody answers, the money goes back to the student.

## The problem

Indian students abroad are targeted by fake-officer scams ("your visa is cancelled, pay a bond now, and do not call anyone").

- Complaints from Indians in the US went from **8 in 2024 to 613 in 2025**
  ([MEA data via Business Standard](https://www.business-standard.com/immigration/75x-jump-in-scams-hits-indians-in-us-amid-visa-crackdown-govt-data-126040600784_1.html)).
- An Indiana University student, **Shreya Bedi**, was kept on the phone for three hours and paid $5,000 in gift cards
  ([WION](https://www.wionews.com/world/indian-student-in-us-becomes-victim-of-digital-arrest-scam-loses-5-000-to-scammers-posing-as-ice-officers-here-s-what-happened-1749373803522/amp)).
- There were **363,019 Indian students** in the US in 2024-25
  ([Open Doors](https://gradright.com/news/india-tops-open-doors-2025-international-students-usa/)).
- **$2.92B** in education remittances left India under the LRS in FY25, mostly over SWIFT in 1 to 3 days
  ([Dataful](https://insights.dataful.in/articles/travel-drives-indias-lrs-outflows-as-education-remittances-moderate)).

Parents in India get the mirror-image call: a cloned voice saying "your son has been arrested, send bail".

The scam works only while the victim is isolated. Companion attacks the isolation, not just the payment:

- Money from home stays in the app. A payment to a new person is **held** until the parent approves it with
  her own passkey, and if nobody answers it **returns to the student**, never to the payee.
- **Check on Arjun**: one tap makes the student's phone prove, with his own passkey, that it really is him.
  A voice can be cloned. A passkey cannot.
- **Silent SOS**: one discreet tap pauses his in-app money, pages his parent and opens a private video call.
  It works whatever way the scammer wants to be paid, including gift cards, Zelle and wires.

## Why this track

An end-user product for people who do not think of themselves as crypto users, a student and a parent. The core is a
payments experience and no crypto word reaches a family's screen. It is not a protocol for other developers, so it is not
entered under Trust, Identity & AI Infrastructure.

## The track's five criteria

Each heading below is one question the Consumer Products & Payments track asks, answered with the gaps included.

### Technical execution

The conditional logic is real and runs on Monad testnet, not in a mock:

- A new payee, a payment over the cap, a payee reported by another family, an unanswered check and a freeze each open a
  **cooling hold**. The money moves into escrow inside the vault and never reaches the payee.
- The parent's decision is a **WebAuthn assertion verified inside the contract** at the P256 precompile (`0x0100`).
- An unanswered hold **expires** and returns the money to the student. Anyone may call it, and a keeper does.
- **Silent SOS** freezes the family with a duress key that can stop everything and start nothing.
- The weekly allowance runs from a merkle-scheduled envelope the parent signed.

Evidence: 95 Foundry tests (including a fork test against the real Agora pair), `pnpm parity` (TypeScript and Solidity agree on
every hash), and `pnpm e2e:testnet`, which plays the whole scene on the live chain with fresh random keys: **110
checks passed**, 23 confirmed transactions, **median 0.47 s** (fastest 0.17 s, slowest 0.85 s).

**Simulated, and disclosed:** the money is Agora's testnet CTK and AUSD (no real value), and "Send money now" plays the
licensed remittance partner. The settlement itself is real: it goes through Agora's Instant Settlement pair.

### Design and invisible blockchain

No crypto word reaches a family's screen: no wallet, gas, seed phrase, token or address. One Face ID per person creates the
account. The student pays a **new person by name and phone number or email**, never an address: the relayer turns the contact
into a stable testnet address, so the same number typed two ways is the same person, and a network report follows it. The
parent's hold card reads "Ravi (+91 ••••• 3210)". The Details screen is the one place that names the machinery, on purpose.

**Known gaps:** a real product would take bank details instead of a phone number, and the testnet address behind the contact
is a labelled stand-in. The flow has not yet been tried on a real phone by a person outside the team.

### Originality

A payment that pauses for family and returns on its own; a parent's Face ID verified inside the contract; a one-tap proof
that it is really the student; and a silent emergency button that works for money the app never sees. None of that exists in a
wallet, and a bank's "trusted person" rule works only inside one bank, where no bank serves both Chennai and Indiana.

### Founder and market fit

The segment is specific: Indian students in the US and their parents in India. The pain is isolation, not payment, and the
evidence above says how fast it is growing. The team is students from the same community, so the first users are families we
can reach through our own campus and alumni networks.

### Traction and the next 100 users

Honest state: **zero real families so far.** every family so far is our own test run, and the
number will move on its own as drills happen.

**This week.** Five to ten real parent-and-student pairs, each running a two-minute drill: the student sends a test "bond",
the parent stops it. The median time to stop comes from the chain, not from us, and appears in the app's **Our network** screen. One quote from a
parent and one from a student, and a list of what confused them, which we fix and report. A teammate may play the parent when a
real one is not available, and the write-up will say so.

**The next 100.** Specific rooms where this exact fear is already felt:

- Tamil student associations and ISA chapters at three named US universities, and orientation sessions for outgoing
  students at Chennai colleges (the scam hits students in their first months, so the pitch lands before they fly).
- Alumni WhatsApp groups of our own college, where the message is "try it with your parents in five minutes".
- Parents are reached through the student, who sends the invite. That is why the parent's side is one WhatsApp link and one
  Face ID, with nothing to set up.

**Beyond.** A licensed LRS partner for real funding, then mainnet, then Telugu and Hindi, then the UK and Canada.

## Deployed contracts (Monad testnet, chain 10143)

| What | Address |
|---|---|
| **`ThunaiVault`** (the app's vault, Agora Instant Settlement on) | [`0xF2BA20FaF5f171DcDB9E7F70a489855d170465C1`](https://testnet.monadexplorer.com/address/0xF2BA20FaF5f171DcDB9E7F70a489855d170465C1) |
| `ScamSignals` | [`0x9d2a0Fbf98E9e2F3B2EE2C1A8E9525B3001614A8`](https://testnet.monadexplorer.com/address/0x9d2a0Fbf98E9e2F3B2EE2C1A8E9525B3001614A8) |
| CTK (Agora's testnet token, 18 decimals) | [`0x7BEb5D9DB0d85cBEa543C04f0dE8c23c2176cd9D`](https://testnet.monadexplorer.com/address/0x7BEb5D9DB0d85cBEa543C04f0dE8c23c2176cd9D) |
| AUSD (Agora's testnet token, 6 decimals) | [`0xa9012a055bd4e0eDfF8Ce09f960291C09D5322dC`](https://testnet.monadexplorer.com/address/0xa9012a055bd4e0eDfF8Ce09f960291C09D5322dC) |
| Agora CTK/AUSD pair | [`0x1Aa8958Aa34cEC8096EF4381cb335effe977b0ae`](https://testnet.monadexplorer.com/address/0x1Aa8958Aa34cEC8096EF4381cb335effe977b0ae) |
| Agora testnet Whitelister | [`0x7c10F56d6f04a51376393a1C3670e966863F6BD5`](https://testnet.monadexplorer.com/address/0x7c10F56d6f04a51376393a1C3670e966863F6BD5) |
| Earlier vault on stand-in tokens (retired, no longer used) | [`0x3aC3F87d6713390aCfeD85133Ca662d7a2ADCf87`](https://testnet.monadexplorer.com/address/0x3aC3F87d6713390aCfeD85133Ca662d7a2ADCf87) |
| ERC-8004 identity registry, agent **#2187** | [`0x8004A818BFB912233c491871b3d84c89A494BD9e`](https://testnet.monadexplorer.com/address/0x8004A818BFB912233c491871b3d84c89A494BD9e) |
| ERC-8004 reputation registry | [`0x8004B663056A597Dffe9eCcC1965A193B7388713`](https://testnet.monadexplorer.com/address/0x8004B663056A597Dffe9eCcC1965A193B7388713) |
| P256 precompile (EIP-7951) | `0x0000000000000000000000000000000000000100` |

`contracts/deployments/10143.agora.json` is the source of truth (`THUNAI_DEPLOYMENT=agora`). Explorer links are standard `/address/` URLs; we could not open them
from our build machine, so check one in a browser.

**Live site:** https://companion-monad.vercel.app (landing page, and the app at `/app`).

## What is verified, and how to check it

`pnpm e2e:testnet` plays the whole scene against the live relayer and agent with fresh random keys. Latest run (13 Oct 2026, Agora vault):
**110 checks passed**, 23 confirmed transactions, **median 0.47 s** (fastest 0.17 s, slowest 0.85 s). Raw numbers:
[`docs/e2e-testnet.json`](e2e-testnet.json). The app's **Our network** screen counts the contracts' own events live. 95 Foundry tests pass (`pnpm contracts:test`), including a fork test
against the real Agora pair. `pnpm parity` proves TypeScript and Solidity agree on every hash.

---

## Agora

**Best Cross-Border Payments App on Monad.** Asked for: *the core features of your app, with a focus on how it enables a user
to send AUSD to another person or across borders.*

**Core features, focused on sending AUSD across borders**

1. **A parent in India funds a family once.** She signs one weekly envelope with a single Face ID (amount, cap, trusted
   payees). Funding from India would come through a licensed LRS partner; on testnet the guardian's **Send money now** plays
   that partner with a labelled stand-in.
2. **The allowance crosses the border by itself.** Each week the agent runs the signed envelope. The home-currency balance
   (CTK) is swapped to AUSD through Agora's Instant Settlement pair in the same transaction, so the student sees it arrive
   in about a second instead of a SWIFT transfer's 1 to 3 days.
3. **The student sends AUSD to another person.** He pays a person by **name and phone number or email**. A trusted payee
   (rent, school) is paid straight through; a new person is held for the parent first. Both are confirmed in about a second.
4. **A comparison with the old way.** A card on both home screens: "A bank transfer: 2-3 business days" against the confirmation
   time **that phone measured**, and a dash until it has measured one. Bank times are labelled typical, not measured.

| Asked for in the deliverable | Where it is |
|---|---|
| Mobile app | An Expo app, one codebase and two roles, laid out for a phone. The web build runs in a phone browser and installs to the home screen. Face ID works in the browser, not inside Expo Go (see Honest limits). |
| Passkey onboarding with Mera | One Face ID per person. No seed phrase, extension, email or OTP. [`app/src/mera/account.ts`](../app/src/mera/account.ts) |
| An AUSD balance | The student's home screen, shown as dollars only. [`app/app/student/index.tsx`](../app/app/student/index.tsx) |
| A completed send/receive settled instantly | The guardian's "Send money now" and the weekly allowance credit the student in one transaction; a student's payment is confirmed in the same call. In the testnet run every such call was confirmed in 0.3 to 0.9 s. |

### Live: Instant Settlement on the real pair

Every allowance and every deposit into a family's account settles through Agora's CTK/AUSD Instant Settlement pair on Monad testnet,
in the same transaction. The Details screen says "Agora Instant Settlement: on", read from the vault itself.

**How it was turned on, using Agora's own testnet tooling** (from Agora's docs: "Executing a Swap" and "Getting Testnet Tokens"):

1. **Approval.** On testnets Agora runs a **Whitelister** (`0x7c10F56d6f04a51376393a1C3670e966863F6BD5`) that anyone may call to grant `APPROVED_SWAPPER`.
   `scripts/agora-testnet-setup.mjs` used it for our vault and our relayer. On mainnet this step is Agora's KYC instead.
2. **Funds.** Agora's AUSD faucet funded the relayer. Monad testnet has no CTK faucet, so the relayer swapped AUSD into CTK on the
   pair itself ([one of those swaps](https://testnet.monadexplorer.com/tx/0x235f59282f9baa071d9c0811652a41996d1bfaa466532f19eaf555dc1cf65667)). The relayer then funds families with real CTK, as a licensed remittance
   partner would.
3. **Switch.** `pnpm agora:check` passed (the vault is past the role gate), `pnpm agora:enable` turned the swap on
   ([tx](https://testnet.monadexplorer.com/tx/0xa74d41207fb028551fcec60ff9b4fee0aed9f39e7fa151dd90b98ffa94c65622)), and the deployment setting `THUNAI_DEPLOYMENT=agora` pointed the live relayer, agent, indexer and
   CRE workflow at this vault.

**Evidence.**
- The full live test, run through the deployed site on this vault, passed **110 checks**.
- Every `Payout` the vault has emitted says `viaAgora = true`, including a family's $3,000 deposit settled in 0.37 s
  ([tx](https://testnet.monadexplorer.com/tx/0x40a785df6c688bd40cf69a076e7603528ebf866a04cb385e28a963fb8c1e4cce)).
- The pair trades at 1:1 here, and every swap returned the amount put in.

**Built in, and still true.** The real CTK has 18 decimals and AUSD has 6, so the vault keeps family money in 6-decimal dollars and
converts at the edge (tested with a mock pair, and against the real pair on a fork). `_settle` wraps the swap in `try/catch` and the
vault refuses to credit AUSD it does not hold (`UnbackedCredit`), so a refused swap can never fail a family's deposit or show a
balance the vault could not pay.

**One honest limit.** The vault calls the pair with `amountOutMin` 0. At the testnet's fixed 1:1 price that is harmless, but a
mainnet vault should take `getAmountsOut` as the floor, as Agora's guide does. It needs a redeploy, so it is disclosed instead.

**Business viability.** A small FX and transfer spread on each allowance, the model remittance companies use. The guardian layer
is free, and it is why families stay. A resident Indian parent never buys a token.

**Video (2 min):** [`docs/DEMO.md`](DEMO.md#agora-video).

---

## Mera UX

**Best Mera-Powered UX on Monad.** Asked for: *how your project meaningfully integrates Mera as the entire account layer.*

Mera is the whole account layer. No Dynamic, no Privy, no email, no OTP, no custody backend anywhere. The server stores display
names and push endpoints, never a key, a PRF output or a plaintext note.

**The finding that made the design work.** To verify a guardian onchain we need a WebAuthn assertion over *our* action hash, but
Mera returns a PRF output, not an assertion. Reading Mera 0.2.0: it generates a random challenge, passes it to the WebAuthn
client, and **never inspects the returned assertion**. Our custom client
([`app/src/mera/webauthn.ts`](../app/src/mera/webauthn.ts)) substitutes the action hash for that challenge and keeps the
assertion, so **one Face ID yields both** the PRF output Mera wants and a signature the contract verifies. DER to raw `r,s`
with low-`s` normalisation, and `challengeIndex` and `typeIndex` computed from the real `clientDataJSON`, are handled there.

| The judges look at | Our answer |
|---|---|
| **Time to first transaction** (taps and seconds) | Measured on testnet: the parent goes from the invite link to a confirmed, signed envelope in **2 taps and 2 Face IDs**, with the transactions confirming in 0.48 s (family registered) and 0.37 s (envelope). The student needs **1 tap and 1 Face ID** to sign in; his first payment is then 2 taps, silent inside the session, confirmed in 0.33 to 0.87 s. The machine time is measured ([`docs/e2e-testnet.json`](e2e-testnet.json)); the human parts (typing a name, the Face ID prompt) have **not** been stopwatch-timed on a phone yet. |
| **Session design** | A **15-minute `thunai/acct` signing session** is scoped to routine actions and signs them with no prompt: paying an approved payee, adding money from home, subscribing a device to alerts. **Always re-prompted, by design:** a guardian's decision on a hold (stop or allow), envelope changes and unfreezing the family. A background session can never release a held payment, however recently someone tapped Face ID. |
| **Session-expiry UX** | When the session ends, an in-place panel says "Tap Face ID to continue" with one button, and the person simply sends again. Details shows "Session active · N min". It is not an error screen. |
| **The stateless test** | Asserted in the testnet e2e (beat 13, software passkeys): a passkey address alone finds the family, the envelope and the encrypted notes again from the chain. In the app, **Forget this device** followed by one Face ID restores the family, and **Open my notes with Face ID** reads the notes back. **Not yet shown on a physical phone.** |
| **Stack composability (bonus)** | **Sponsored gas:** a relayer pays gas for every action and holds no spending power, so no family member ever holds a gas token. **Onchain P256 verification:** the contract verifies the parent's passkey assertion itself at the `0x0100` precompile. **Intents:** the student signs an EIP-712 withdraw intent that the relayer only carries. |

**Video (2 min):** [`docs/DEMO.md`](DEMO.md#mera-ux-video).

---

## Mera Many Keys

**One Passkey, Many Keys.** Asked for: *how your project meaningfully utilizes Mera in non-account work.*

One passkey per person, three independent keys doing three different jobs. Every salt is ours and distinct, so each is an
isolated namespace:

| Namespace | Salt | What it does | Account work? |
|---|---|---|---|
| **Account** (`thunai/acct`) | `keccak256("thunai/acct")` | Signs the student's withdrawals, the parent's deposits and device subscriptions. | Yes |
| **Notes** (`thunai/notes`) | `keccak256("thunai/notes")` | An AES-256-GCM key (the PRF output itself) that encrypts the person's private family question. The **ciphertext is stored in the vault contract**, so any device with the same passkey reads it back after one Face ID. | **No: encryption** |
| **Duress** (`thunai/duress`) | `keccak256("thunai/duress")` | Registered onchain as the only address that can freeze a family. It holds no funds. It is what Silent SOS signs with. | **No: a capability** |

**Where the notes salt comes from, stated precisely.** We first used Mera's secret-vault API for the notes. That API generates
its own random salt and keeps the blob in the browser, so a fresh device could not read it. We now derive the notes key from
the PRF output with **our own fixed salt** and store only ciphertext onchain (`setNotes`, authorised by that person's passkey
and replay-proof by version). Each person's notes are encrypted under their own key; the contract only ever sees ciphertext.
Nothing sensitive is persisted to disk or to a server.

**The cross-device test.** Open the app on a second device with the same passkey and tap Face ID: the account and duress
addresses come back identical because they are derived, never stored, the Details "Keys" panel lists all three namespaces with
their salts, and **Open my notes with Face ID** decrypts the same notes from the chain.

| Claim | Evidence |
|---|---|
| Notes are ciphertext onchain, and any device with the same key reads them back | testnet e2e beat 13: stored by the passkey, read back by a "fresh device"; the wrong key and a tampered blob are rejected; an old assertion cannot roll the notes back. |
| Contract rules around notes | Foundry: separate roles, a stranger or the other role cannot write, size limit, only the relayer submits, replay-proof. |
| **The PRF output itself on a real phone** | **Unverified.** The e2e uses a deterministic stand-in for the authenticator's PRF output because a script cannot do WebAuthn PRF. The encryption, storage and read-back are real. `getPasskeyPrfOutput` with the notes salt is written and typechecks but has not run on a phone. |

**Why the duress key is the interesting one.** It can only *stop* things. Handing it over, or being forced to use it, costs
nothing, and only the parent's passkey can lift a freeze. The student can stop all in-app money from a phone someone else is
watching, and cannot be made to start it again. Tests: `test_DuressKeyFreezesOutflows`, `test_OnlyGuardianCanUnfreeze`,
`test_FreezeSignatureCannotBeReplayed`, and for SOS `test_OnlyTheGuardianPasskeyLiftsAnSos`.

**Video (2 min):** [`docs/DEMO.md`](DEMO.md#many-keys-video).

---

## Envio

**Status: deployed and live.** Envio HyperIndex 3.14 on Envio Cloud, indexing Monad testnet (chain 10143) from the block the vault
was created in (70,125,617, the Agora vault) and following the chain head. GraphQL endpoint: `https://indexer.dev.hyperindex.xyz/228e4fb/v1/graphql`.

Asked for: *how your project meaningfully uses Envio's HyperIndex, HyperSync or HyperRPC to power real on-chain data.*

**What it indexes.** All 16 events of `ThunaiVault` and `ScamSignals` (families, envelopes, deposits, allowance payouts, holds and
how they ended, withdrawals, checks on the student, freezes, Silent SOS, encrypted-notes versions, and network reports) into eight
entities. `Family` carries **derived** lists of its holds, payouts, checks, withdrawals and SOS presses, so one query returns a
family's whole history. `NetworkStats` is an **aggregate** kept up to date by the handlers: families, holds opened, payments a parent
stopped, holds that expired, money protected, allowances delivered, checks answered, reports filed, SOS presses, and the **median and
fastest time from a hold opening to a parent stopping it**, recomputed as each stop arrives. `Signal` holds each reported payee's
count, which is what raises the hold level for the next family.

**What it powers.**
- **The app** reads the network numbers ("Families protected") and the **evidence on a hold card** ("N families reported this
  payee") from Envio first, with the same labelled fallback. The decision on a hold is never read from the indexer: it is always read
  from the contract, so an indexer delay cannot show a family a stale "safe".

**Why it matters here, measured.** On the free hosting plan our relayer's own counter restarts from scratch after every redeploy, so
it is often far behind the chain: on the earlier vault it was 77,000 blocks behind when we checked, and right after the switch to the
Agora vault it showed 0 payments stopped while Envio, at the chain head, showed 4. Envio's totals match the contract's own counters
exactly: 2 families, 14 holds and 2 SOS presses on the Agora vault (and 20, 101 and 17 on the earlier vault). It also records that all
6 of the vault's settlements went through Agora.

**Checked.**
- `pnpm check:indexer` validates `config.yaml` against the JSON schema inside the pinned `envio` package, and every event signature
  against the compiled ABI. It catches the v2-style config that failed our first Envio build.
- `ENVIO_GRAPHQL_URL=https://indexer.dev.hyperindex.xyz/228e4fb/v1/graphql pnpm check:envio` sends every query the app and site use to the live indexer: all five are accepted.

**Not yet seen:** the hold card's evidence line on a physical phone.

**Video (2 min):** [`docs/DEMO.md`](DEMO.md#envio-video).

---

## Chainlink CRE

**Status: built, and `cre workflow simulate` passes against live Monad testnet.** The saved output is
[`docs/cre-simulation.txt`](cre-simulation.txt); the workflow, its limits and how to run it are in [`cre/README.md`](../cre/README.md).
It is **not deployed to the CRE network** (that needs Early Access approval).

Asked for: *how your project meaningfully utilizes Chainlink CRE as an orchestration layer.*

Companion has two jobs that must happen with nobody pressing a button: sending each family's weekly allowance, and looking
after holds nobody answered. The CRE workflow `companion-orchestrator` is the schedule and the eyes for both.

| Step | What CRE does |
|---|---|
| Trigger | A cron trigger, every minute. |
| Onchain read | `EVMClient` reads Monad testnet (chain 10143, `monad-testnet`): how many families and holds exist, which families have an allowance due, and the status, `openedAt` and `releaseAt` of each recent hold. CRE allows 15 chain reads per run, so the workflow batches everything through Multicall3 and makes **two** reads however many families there are. |
| Decide | From the contract's own numbers only: is the allowance due, is the hold still open, has its time run out. |
| External call | `HTTPClient` calls Companion's agent at `/agent/cre/apply` with a secret from CRE's secret store, to run the allowance, expire the hold (money returns to the student) or remind the parent. |

**Safe by construction.** None of the three actions can pay a payee. `runAllowance` runs an envelope the parent already
signed; `expireHold` only returns money to the student; `repage` only sends a notification. The agent re-checks the chain
before acting, so a stale or forged request does nothing. A guardian's passkey remains the only way to release a payment.

**Honest limit: the actions are not CRE onchain writes.** CRE writes onchain through a forwarder to a contract that implements
`onReport`; `ThunaiVault` does not, and adding a second authority over a vault that holds family money days before a deadline
is the wrong trade. So reads are onchain and actions go through the agent's authority-free keeper key.

**Fallback.** `ORCHESTRATOR=cre|keeper` on the agent. With `cre`, the agent's own timer becomes a standby that runs only if no
authenticated CRE call has arrived for five minutes, so a stopped workflow can never leave an allowance unsent or a hold
unexpired. Tested in `pnpm e2e` (beat 11c).

**What the simulation showed** (live testnet, saved in `docs/cre-simulation.txt`): the workflow read the vault (19 families, 94 holds), found a hold the test had just opened and left unanswered, and had the agent remind the parent about it ("Hold 94 still waiting after 172s: parent reminded (classified as script 1)", the fake-officer scam). In the same run it found four real holds nobody had answered and had the agent return that money to the students. `E2E_CRE_DEMO=1 pnpm e2e:testnet` reproduces it. With the deployed agent as the target and nothing due, it correctly did nothing.

**Video (2 min):** [`docs/DEMO.md`](DEMO.md#chainlink-video), showing a successful `cre workflow simulate`.

---

## Alchemy

Asked for: *how your project meaningfully integrates one or more of Alchemy's services or tools.*

Alchemy supports Monad testnet for RPC, websockets and webhooks. We use two of those, each doing a job that matters in a rescue.
The setup guide is [`docs/ALCHEMY.md`](ALCHEMY.md).

| Service | What it does for Companion | Status |
|---|---|---|
| **Monad testnet RPC, as a failover** | The relayer and agent send each request to the primary RPC first. If it errors, the same request is retried on Alchemy, including `eth_sendRawTransactionSync`, so one provider's outage cannot stop a rescue. | **Verified** against the live endpoint: `pnpm check:failover` shows Alchemy answering with the primary down, the primary answering when healthy, and failing without the fallback (so the first check really used Alchemy). |
| **Webhooks** (custom, GraphQL) | A webhook watches the vault for `HoldOpened` and `SOSRaised` and calls the agent at `/alchemy/webhook`. The parent is paged even if our own relayer's call to the agent never arrived. | **Delivery path verified:** an Alchemy webhook on Monad testnet delivered thousands of signed messages through the website to the deployed agent, which accepted them (signature checked) and skipped the unrelated events. **The filtered webhook (our vault's two events only) has not yet fired** for the holds and SOS our live tests created, so paging a parent from an Alchemy event is not claimed. |

**Safe by construction.** The webhook route answers only a body signed with the webhook's key (HMAC-SHA256 over the exact bytes), and
not at all without the key. It never trusts the payload for anything that matters: it re-reads the hold from the chain before paging,
and skips anything the relayer path already paged, so a parent is never paged twice for one event.

**Why not for event counting.** Alchemy's free tier allows 10 blocks per `eth_getLogs` request, which is too small to backfill the
traction counters, so those keep using the public RPC.

**Video (2 min):** [`docs/DEMO.md`](DEMO.md#alchemy-video).

---

## Best Community Team

Which community does your team represent? **[YOUR CAMPUS GROUP, as selected on the hackathon profile]**

The group is selected on our hackathon profile. Nothing else in this repository claims a community affiliation.

---

## Also built (not bounties)

- **ERC-8004 agent identity.** The agent is registered as **#2187**, owned by the team account and never the vault. After a
  parent stops a payment, the family's own guardian account records one reputation entry (no family, payee, handle or amount).
  The relayer tops up gas and broadcasts only the exact expected call. Details shows "agent #2187 · N verified saves". The
  saves recorded so far include our own test runs.

## Honest claims

| We say | We never say |
|---|---|
| "Money from home can't leave Companion in one phone call." | "Protects Arjun's bank account." Gift cards and Zelle never touch it. |
| "A hold Kavya can cancel. The money never left." | "Clawback." Nothing is ever pulled back from anyone. |
| "Proves it's really Arjun, on his own phone, right now." | "Proves Arjun is safe." A passkey can't be cloned; a person can be coerced. |
| "Silent SOS breaks the isolation whatever way the scammer wants to be paid." | That SOS stops a gift-card purchase. It does not. |
| "Network reports raise the hold level; they never block on their own. Payees on the family's signed schedule are immune." | "Blocks scammers network-wide." |
| "Hashed handles are pseudonymous." | "Private" or "anonymous." |
| "Funding from India would come through a licensed LRS partner; testnet uses a labelled stand-in." | Anything implying a resident Indian buys crypto. |
| "Rules decide, then explain." | "AI detects scams." A model can write the explanation, and can never move money. |
| "The weekly allowance crosses in about a second." | A figure more precise than the measured one above. |

## Judge instructions

**Fastest look, no passkeys needed:** open https://companion-monad.vercel.app. Its phone screens come from a real run on the live vault
(family 15, every step with a transaction hash in `frontend/data/demo.json`), and the app's **Our network** screen shows live counts from the chain. This is the
read-only view.

**The full two-device flow (about two minutes).** Open https://companion-monad.vercel.app/app on two devices, or in two browser
profiles.

1. **Device 1 (Arjun).** Tap **Open the app**, enter a name, tap **Create with Face ID**, then **Copy invite link**.
2. **Device 2 (Kavya).** Open the link, tap **Accept with Face ID**, and sign the weekly allowance. Tap **Turn on alerts**.
3. On Device 2 tap **Send money now** (the stand-in float plays the licensed remittance partner).
4. On Device 1, tap **Send**, enter a **name and a phone number** (for example "Ravi Kumar", "+91 98765 43210"), an amount and a
   reason such as "immigration bond". It is **held**.
5. On Device 2, open the held payment and tap **Stop it**. The money returns to Arjun.
6. Try **Check on Arjun** (Device 2) and **Someone is asking me for money** (Device 1). Lift the pause with Face ID.

**There is no pre-made demo family for judges, and that is deliberate.** A passkey is bound to the device that made it, so a
family we created cannot be signed into from your device. Creating one takes the two minutes above. The team's own demo family,
created on this site on the team's devices, is what appears in our videos.

Passkeys need HTTPS or `localhost` and are tied to one host, so open both devices on the same address. Details, including the
tunnel for a local run, are in [`docs/DEMO.md`](DEMO.md).

## Honest limits

(Copied from [`docs/STATUS.md`](STATUS.md).)

- **Testnet only.** The money is Agora's testnet CTK and AUSD, which carry no real value.
- **Agora approval came from Agora's testnet self-service Whitelister.** On mainnet it would need Agora's KYC. The swap sets no minimum output (`amountOutMin` 0), harmless at the testnet's fixed 1:1 price but not acceptable on mainnet.
- **Face ID works in the phone's browser, not inside Expo Go.** React Native has no WebAuthn.
- **Not yet proven on physical phones.** Desktop browser and automated tests with software passkeys only. This includes the
  PRF-derived notes key, Silent SOS as a screen, and push delivery.
- **It protects money held in the app, not the student's bank account.**
- **Parent alerts:** a WhatsApp link and opening the app work. Browser push is built (service worker, signed enrolment, the
  agent's send) but no real browser has received one yet; on iPhone the app must be added to the Home Screen.
- **The AI explanation is optional and was not used.** Our Anthropic account has no credit, so every hold used the rules' own
  explanation.
- **The Envio indexer runs on Envio Cloud's free development plan.** If the deployment is ever unavailable, the site falls back to the relayer's own count and says so.
- **The CRE workflow is not deployed to the CRE network** (that needs Early Access), and CRE does not write onchain in our design (see the Chainlink section).
- **The vault-filtered Alchemy webhook has not fired yet.** Alchemy's deliveries do reach the deployed agent (verified with an unfiltered webhook), and the failover RPC is live.
- **Cleanverse and Aurora are not built.**
- **The English-only app** has no Tamil UI.
