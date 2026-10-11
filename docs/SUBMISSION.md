# Submission: Companion

**Track: Consumer Products & Payments.**
**Bounties: Agora Cross-Border Payments, Mera "Best Mera-Powered UX", Mera "One Passkey, Many Keys", Best Community Team (picked on our profile).**
Not entered: Envio (included, not deployed), Cleanverse, Aurora. See [Honest limits](#honest-limits).

Every claim here matches [`docs/STATUS.md`](STATUS.md), which lists what is verified on testnet, what is
built but unverified, and what is not done. Where something does not work the way a bounty might expect,
this document says so.

> **Companion makes family a student's second key.** Scammers win by cutting a student off from their family.
> Companion moves the allowance across the border in about a second, and when something looks wrong it
> pauses the money and tells the parent before anything leaves.

## The problem

Indian students abroad are targeted by fake-officer scams ("your visa is cancelled, pay a bond now, and do
not call anyone"). Complaints from Indians in the US went from **8 in 2024 to 613 in 2025**
([MEA data via Business Standard](https://www.business-standard.com/immigration/75x-jump-in-scams-hits-indians-in-us-amid-visa-crackdown-govt-data-126040600784_1.html)).
An Indiana University student, Shreya Bedi, was kept on the phone for three hours and paid $5,000 in gift
cards ([WION](https://www.wionews.com/world/indian-student-in-us-becomes-victim-of-digital-arrest-scam-loses-5-000-to-scammers-posing-as-ice-officers-here-s-what-happened-1749373803522/amp)).
There were 363,019 Indian students in the US in 2024-25
([Open Doors](https://gradright.com/news/india-tops-open-doors-2025-international-students-usa/)), and
$2.92B in education remittances left India under the LRS in FY25, mostly over SWIFT in 1 to 3 days
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

An end-user product for people who do not think of themselves as crypto users, a student and a parent. The core
is a payments experience and no crypto word reaches a family's screen. It is not a protocol for other
developers, so it is not entered under Trust, Identity & AI Infrastructure.

## How Companion meets the track's bar

The Consumer Products & Payments track asks five questions. Our answers, including where we fall short:

| The track asks | Our answer |
|---|---|
| **Do the mechanics execute onchain, not simulated?** | The conditional logic is real and runs on Monad testnet: holds on a new payee, spending caps, scheduled payees, expiry that returns the money, guardian release verified at the P256 precompile, SOS freeze. 86 checks pass against the live chain. **Simulated, and disclosed:** the money is labelled stand-in tokens, "Send money now" plays the licensed remittance partner, and the real Agora swap is off until Agora whitelists the vault. |
| **Would a non-crypto user finish the flow without noticing it is crypto?** | No crypto word reaches a family's screen, there is no seed phrase or extension, and the whole flow is one Face ID per person. **Known friction:** sending to a *new* person asks the student to paste an address, which is where the testnet shows through (a real product takes bank details). The flow has not yet been tried on a real phone by a person who is not on the team. |
| **A genuinely new experience, or a wallet with new branding?** | A payment that pauses for family and returns on its own, a parent's Face ID verified inside the contract, and a one-tap proof that it is really the student. None of that exists in a wallet. |
| **A specific, named segment and real understanding of its pain?** | Indian students in the US and their parents in India. The pain is isolation, not payment: the scam works only while the student is kept off the phone with family (8 complaints in 2024 to 613 in 2025; Shreya Bedi, three hours on the phone). The product breaks the isolation. |
| **User testing, and a plan for the next 100 users?** | **No real families yet.** `/traction` reports 0 real families, and separates our own test runs. The plan below is what happens next. |

## Traction and the next 100 users

Honest state: zero real families so far, and the number on the traction page will move on its own as drills happen.

**This week.** Five to ten real parent-and-student pairs, each running a two-minute drill: the student sends a test "bond", the parent stops it. The median time to stop comes from the chain, not from us, and appears on `/traction`. One quote from a parent and one from a student, and a list of what confused them, which we fix and report. A teammate may play the parent when a real one is not available, and the write-up will say so.

**The next 100.** Not "everyone needs payments", but specific rooms where this exact fear is already felt:
- Tamil student associations and ISA chapters at three named US universities, and orientation sessions for outgoing students at Chennai colleges (the scam hits students in their first months, so the pitch lands before they fly).
- Alumni WhatsApp groups of our own college, where the message is "try it with your parents in five minutes".
- Parents are reached through the student, who sends the invite. That is why the parent's side is one WhatsApp link and one Face ID, with nothing to set up.

**Beyond.** A licensed LRS partner for real funding, then mainnet, then Telugu and Hindi, then the UK and Canada.

## Deployed contracts (Monad testnet, chain 10143)

| What | Address |
|---|---|
| **`ThunaiVault`** (the app's vault) | [`0x3aC3F87d6713390aCfeD85133Ca662d7a2ADCf87`](https://testnet.monadexplorer.com/address/0x3aC3F87d6713390aCfeD85133Ca662d7a2ADCf87) |
| `ScamSignals` | [`0xC0F7e94758975A33Bd7c1849be325734f20DA16e`](https://testnet.monadexplorer.com/address/0xC0F7e94758975A33Bd7c1849be325734f20DA16e) |
| Stand-in CTK (labelled, no value) | [`0xCf73DA999EE8b7B6181a32Ab95aEFE44edA10acF`](https://testnet.monadexplorer.com/address/0xCf73DA999EE8b7B6181a32Ab95aEFE44edA10acF) |
| Stand-in AUSD (labelled, no value) | [`0x93e068B5f92eB225A08b474f8C115C21B51520C6`](https://testnet.monadexplorer.com/address/0x93e068B5f92eB225A08b474f8C115C21B51520C6) |
| **Agora-ready vault** (real CTK and AUSD, awaiting whitelist) | [`0xF2BA20FaF5f171DcDB9E7F70a489855d170465C1`](https://testnet.monadexplorer.com/address/0xF2BA20FaF5f171DcDB9E7F70a489855d170465C1) |
| Agora CTK/AUSD pair | [`0x1Aa8958Aa34cEC8096EF4381cb335effe977b0ae`](https://testnet.monadexplorer.com/address/0x1Aa8958Aa34cEC8096EF4381cb335effe977b0ae) |
| ERC-8004 identity registry, agent **#2187** | [`0x8004A818BFB912233c491871b3d84c89A494BD9e`](https://testnet.monadexplorer.com/address/0x8004A818BFB912233c491871b3d84c89A494BD9e) |
| ERC-8004 reputation registry | [`0x8004B663056A597Dffe9eCcC1965A193B7388713`](https://testnet.monadexplorer.com/address/0x8004B663056A597Dffe9eCcC1965A193B7388713) |
| P256 precompile (EIP-7951) | `0x0000000000000000000000000000000000000100` |

`contracts/deployments/10143.json` is the source of truth. Explorer links are standard `/address/` URLs; we
could not open them from our build machine, so check one in a browser.

## What is verified, and how to check it

`pnpm e2e:testnet` plays the whole scene against the live relayer and agent with fresh random keys. Latest run
(12 Oct 2026): **86 checks passed**, 19 confirmed transactions, **median 1.23 s** (fastest 0.65 s, slowest 1.53 s).
Raw numbers: [`docs/e2e-testnet.json`](e2e-testnet.json). The landing page lists every transaction of a recorded
run with a link, and `/traction` counts the contracts' own events live. 95 Foundry tests pass (`pnpm contracts:test`),
including a fork test against the real Agora pair. `pnpm parity` proves TypeScript and Solidity agree on every hash.

---

## Agora

**Best Cross-Border Payments App**

| Asked for | Where it is |
|---|---|
| Mobile app | An Expo app, one codebase and two roles, laid out for a phone. The web build runs in a phone browser and installs to the home screen. Face ID works in the browser, not inside Expo Go (see Honest limits). |
| Mera passkey onboarding | One Face ID per person. No seed phrase, extension, email or OTP. [`app/src/mera/account.ts`](../app/src/mera/account.ts) |
| Visible AUSD balance | The student's home screen, shown as dollars only. [`app/app/student/index.tsx`](../app/app/student/index.tsx) |
| Instant send and receive between parent and student | The guardian's "Send money now" (signed by her own account key) and the weekly allowance both credit the student in one transaction. In the testnet run every such call was confirmed in 0.9 to 1.5 s. |
| A comparison with the old way | A card on both home screens: "A bank transfer: 2-3 business days" against the confirmation time **that phone measured**, and a dash until it has measured one. Bank times are labelled typical, not measured. |

### Stated plainly: the Agora swap is built but switched off

The pair's swap is gated by `APPROVED_SWAPPER`, and **our vault has not been whitelisted**. Until it is,
`AGORA_ENABLED=false` and the vault credits AUSD from a pre-funded float, which the app labels
("Settlement: pre-funded fallback while Agora whitelisting is pending"; Details says "Agora Instant Settlement:
off (disclosed fallback)").

What is ready, and how we know:

- **`pnpm agora:check`** asks the live pair whether our vault may swap, by simulating a zero-amount swap from the
  vault with `eth_call` and reading the pair's missing-role error. Today it reports the vault is built on the pair's
  real CTK and AUSD, handles the CTK's 18 decimals against AUSD's 6, and is **not** whitelisted.
- **A second vault** (`0xF2BA20Fa...`) is deployed on the real tokens and is the address to whitelist. The vault the
  app uses is built on labelled stand-in tokens we can mint, so demos are always funded.
- **Decimals.** The real CTK has 18 decimals and AUSD has 6. The vault keeps family money in 6-decimal dollars and
  converts at the edge, tested with a mock pair and **against the real pair on a fork**, which also proves the real
  pair refuses an unwhitelisted vault and that our fallback survives it instead of failing a family's deposit.
- `_settle` wraps the swap in `try/catch`, and the vault tracks `ausdLiabilities` and refuses to credit AUSD it does not
  hold (`UnbackedCredit`), so the fallback cannot show a balance the vault could not pay.
- **The ready-to-paste whitelist request** is [`docs/AGORA_REQUEST.md`](AGORA_REQUEST.md).

What cannot be shown until Agora acts: a swap that **succeeds** on the real pair. We cannot mint the real CTK either
(owner-only), so the request also asks for a little test CTK.

Business model: a small FX and transfer spread on each allowance, the model remittance companies use. The guardian
layer is free, and it is why families stay. Regulatory shape: a resident Indian parent never buys a token. On testnet
the relayer's labelled stand-in plays the licensed remittance partner.

---

## Mera UX

**Best Mera-Powered UX**

Mera is the whole account layer. No Dynamic, no Privy, no email, no OTP anywhere.

**The finding that made the design work.** To verify a guardian onchain we need a WebAuthn assertion over *our* action
hash, but Mera returns a PRF output, not an assertion. Reading Mera 0.2.0: it generates a random challenge, passes it
to the WebAuthn client, and **never inspects the returned assertion**. Our custom client
([`app/src/mera/webauthn.ts`](../app/src/mera/webauthn.ts)) substitutes the action hash for that challenge and keeps the
assertion, so **one Face ID yields both** the PRF output Mera wants and a signature the contract verifies. DER to raw
`r,s` with low-`s` normalisation, and `challengeIndex` and `typeIndex` computed from the real `clientDataJSON`, are handled there.

| Asked for | Status |
|---|---|
| One passkey ceremony at onboarding, per person | **Built.** One ceremony derives the account key and the duress key together by evaluating two PRF salts. Run with software passkeys and in a desktop browser; **not yet on a physical phone.** |
| No seed phrase, extension, email or OTP | True of the whole app. |
| Scoped, prompt-free signing | **Built.** A 15-minute `thunai/acct` session signs routine actions (paying an approved payee, adding money from home, subscribing a device to alerts). Details shows "Session active · N min". When it ends, a "Tap Face ID to continue" panel appears with one button. Guardian decisions, envelope changes and unfreeze **always** prompt, by design. |
| Stateless test | **Asserted in the testnet e2e** (software passkeys): a passkey address alone finds the family, the envelope and the encrypted notes again from the chain. In the app, "Forget this device" followed by one Face ID restores the family; "Open my notes with Face ID" then reads the notes back. **Not yet shown on a physical phone.** |

---

## Mera Many Keys

**One Passkey, Many Keys**

One passkey per person, three independent keys doing three different jobs. Every salt is ours and distinct:

| Key | Salt | What it does | Account work? |
|---|---|---|---|
| **Account key** (`thunai/acct`) | `keccak256("thunai/acct")` | Signs the student's withdrawals, the parent's deposits and device subscriptions. | Yes |
| **Notes key** (`thunai/notes`) | `keccak256("thunai/notes")` | AES-256-GCM key (the PRF output itself) that encrypts the person's private family question. The **ciphertext is stored in the vault contract**, so any device with the same passkey reads it back after one Face ID. | No: encryption |
| **Duress key** (`thunai/duress`) | `keccak256("thunai/duress")` | Registered onchain as the only address that can freeze a family. It holds no funds. It is what Silent SOS signs with. | No: a capability |

**What changed from our first plan, honestly.** We first used Mera's secret-vault API for the notes, which generates its
own random salt and keeps the blob in the browser, so a fresh device could not read it. We now derive the notes key from
the PRF with **our own fixed salt** and store only ciphertext onchain (`setNotes`, authorised by that person's passkey and
replay-proof by version). Each person's notes are encrypted under their own key; the contract only ever sees ciphertext.

| Claim | Evidence |
|---|---|
| Notes are ciphertext onchain, and any device with the same key reads them back | testnet e2e beat 13: stored by the passkey, read back by a "fresh device", the wrong key and a tampered blob are rejected, an old assertion cannot roll the notes back. |
| Contract rules around notes | Foundry: separate roles, a stranger or the other role cannot write, size limit, only the relayer submits, replay-proof. |
| **The PRF output itself on a real phone** | **Unverified.** The e2e uses a deterministic stand-in for the authenticator's PRF output because a script cannot do WebAuthn PRF. The encryption, storage and read-back are real. `getPasskeyPrfOutput` with the notes salt is written and typechecks but has not run on a phone. |

**Why the duress key is the interesting one.** It can only *stop* things. Handing it over, or being forced to use it,
costs nothing, and only the parent's passkey can lift a freeze. The student can stop all in-app money from a phone someone
else is watching, and cannot be made to start it again. Tests: `test_DuressKeyFreezesOutflows`, `test_OnlyGuardianCanUnfreeze`,
`test_FreezeSignatureCannotBeReplayed`, and for SOS `test_OnlyTheGuardianPasskeyLiftsAnSos`.

**Cross-device test.** Open the app on a second device with the same passkey: the account and duress addresses come back
identical because they are derived, never stored, and the Details "Keys" panel lists all three namespaces with their salts.

---

## Envio

**Not entered.** The indexer (config, schema with derived entities, handlers) is in [`/indexer`](../indexer) and points at
our real deployment, including the new `SOSRaised` and `NotesStored` events. `pnpm check:indexer` validates every event
signature against the compiled ABI. It is **not deployed**, because Envio's tooling does not run on the Windows machine we
built on; the hosted-service steps are in [`docs/ENVIO_DEPLOY.md`](ENVIO_DEPLOY.md). The app is built to read it first and
falls back to our relayer, which counts the contracts' events itself. The screens and Details name whichever source is active.

---

## Also built (not bounties)

- **ERC-8004 agent identity.** The agent is registered as **#2187**, owned by the team account and never the vault. After
  a parent stops a payment, the family's own guardian account records one reputation entry (no family, payee, handle or
  amount). The relayer tops up gas and broadcasts only the exact expected call. Details shows "agent #2187 · N verified
  saves". Note that the saves recorded so far include our own test runs.
- **Traction page** (`/traction` on the landing page): counts of the contracts' own events, with real families and our own
  test runs reported apart.

## Best Community Team

The campus group is selected on our hackathon profile. Nothing in this repository claims a community affiliation.

---

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

## Judge instructions

**Fastest look, no passkeys needed:** open the landing page. Its phone screens, numbers and the "Verify it yourself"
table come from a recorded run of a fictional family on testnet, and `/traction` shows live counts. This is the read-only
view. To regenerate it: `pnpm seed:demo` (needs `pnpm dev` running).

**Two-device demo:**

1. **Device 1 (Arjun).** Open the site and tap **Open the app** (it opens `/app` on the same site), enter a name, tap **Create with Face ID**, then copy the invite link.
2. **Device 2 (Kavya).** Open the link, tap **Accept with Face ID**, and sign the weekly allowance. Tap **Turn on alerts**.
3. On Device 2 tap **Send money now** (the stand-in float plays the licensed remittance partner).
4. On Device 1, send a small amount to a **new address** with a reason such as "immigration bond". It is **held**.
5. On Device 2, open the held payment and tap **Stop it**. The money returns to Arjun.
6. Try **Check on Arjun** (Device 2) and **Someone is asking me for money** (Device 1). Lift the pause with Face ID.

Passkeys need HTTPS or `localhost` and are tied to one host, so open both devices on the same address. Details,
including the tunnel, are in [`docs/DEMO.md`](DEMO.md).

## Honest limits

- **Testnet only.** The tokens are labelled stand-ins and carry no real value.
- **The Agora swap is built but switched off** until Agora whitelists our vault. The vault uses a pre-funded float and says so.
- **Face ID works in the phone's browser, not inside Expo Go.** React Native has no WebAuthn.
- **Not yet proven on physical phones.** Desktop browser and automated tests with software passkeys only. This includes the
  PRF-derived notes key, Silent SOS as a screen, and push delivery.
- **It protects money held in the app, not the student's bank account.**
- **Parent alerts:** a WhatsApp link and opening the app work. Browser push is built (service worker, signed enrolment, the
  agent's send) but no real browser has received one yet; on iPhone the app must be added to the Home Screen.
- **The AI explanation is optional and was not used.** Our Anthropic account has no credit, so every hold used the rules' own
  explanation.
- **Envio is not deployed.** The app falls back to the relayer's own event counts and says so.
- **Cleanverse and Aurora are not built.** Cleanverse's documentation is behind an invitation code. Aurora lists Monad as
  supported but does not say whether testnet is, and a live flow would need real funds.
- **The English-only app** has no Tamil UI.
