# COMPANION  ·  Thunai

**Scammers win by cutting you off from family. Companion makes family your second key, and every family's save protects the next.**

*Companion* (**Thunai** in Tamil, which means "companion") is a family money agent for Indian parents with a child studying abroad.

- **Every week**, it moves the allowance across borders in about a second (measured median 0.53 s on Monad testnet).
- **When something is wrong**, it pauses the money and pages Kavya before anything moves.

Built for **Monad Metropolis** · **Track: Consumer Products & Payments** · Monad Testnet (10143)

**Bounties:** Agora Cross-Border Payments · Mera "Best Mera-Powered UX" · Mera "One Passkey, Many Keys" · Best Community Team. Chainlink CRE is built and simulated; the Envio indexer is live; Alchemy's failover is verified and its alert webhook is built. Each is described with its exact status in [`docs/SUBMISSION.md`](docs/SUBMISSION.md).

**Live:** https://companion-monad.vercel.app (the app is at `/app`). Testnet only.

**All docs:** [`docs/README.md`](docs/README.md) is the index of every guide, command and code folder.

**Contents**

1. [The idea in one minute](#1-the-idea-in-one-minute)
2. [The problem, in one scene](#2-the-problem-in-one-scene)
3. [The cast](#3-the-cast)
4. [How it works, the short version (sequence diagram)](#4-how-it-works-the-short-version)
5. [How it works, flow by flow](#5-how-it-works-flow-by-flow)
6. [What each person sees (screen by screen)](#6-what-each-person-sees)
7. [How to use it](#7-how-to-use-it)
8. [What it does, and what it does not](#8-what-it-does-and-what-it-does-not)
9. [Why it needs Monad](#9-why-it-needs-monad)
10. [Architecture](#10-architecture)
11. [Running it](#11-running-it)
12. [Deployed addresses](#12-deployed-addresses)
13. [Track and bounties](#13-track-and-bounties)
14. [Honest limits](#14-honest-limits)
15. [Business model](#15-business-model)

---

## 1. The idea in one minute

Most scams against international students are not clever. They are **isolating**. The caller
says "do not tell anyone, your phone is being monitored," and the student, alone and afraid in
another time zone, pays. The money is the smaller half of the harm. The silence is the bigger half.

Companion attacks the silence.

1. **A parent funds a family account.** Kavya, in Chennai, approves one weekly "envelope" with
   a single Face ID: how much, how often, which payees are already trusted (rent, the
   university), and what size of payment is unusual.
2. **The allowance runs itself.** Every week the agent settles the money across borders and
   the student, Arjun, sees it arrive. Nobody opens an app.
3. **Anything unusual pauses first.** If Arjun sends money to a *new* person, an unusual
   amount, or a payee other families have reported, the money does not go to that person. It
   moves into **escrow inside the contract**, and Kavya's phone is paged.
4. **Kavya decides, with her own face.** One tap on **Stop it** returns the money to Arjun.
   One tap on **Allow** sends it on. The decision is checked **inside the smart contract**
   against her passkey, so no server, no company and no scammer can override her.
5. **If nobody answers, the money comes home.** After the hold window, anyone can expire the
   hold, and the money returns to Arjun. A keeper does it automatically.

Two extra tools cover what the vault cannot see:

- **Check on Arjun**: Kavya taps once, and Arjun's phone proves with one Face ID that it is
  really him, right now. This answers voice-clone calls ("Mom, it's me, send money").
- **Silent SOS**: for scams paid with gift cards or Zelle, which never touch Companion. One
  discreet tap pauses everything in the app, pages Kavya, and opens a private video call, so
  Arjun is no longer alone on that line.

**The one-sentence version:** the scam only works while the family is kept apart, so
Companion puts the family *inside* the payment.

---

## 2. The problem, in one scene

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

## 3. The cast

```
   KAVYA (guardian)                  ARJUN (student)                 THE SCAMMER
   Chennai, India                    Bloomington, USA                 anywhere
   ─────────────────                 ─────────────────                ────────────
   Funds the family.                 Receives the weekly              Wants Arjun alone,
   Signs the weekly                  allowance. Sends money           scared and quick.
   envelope. Decides                 to rent, school, friends.        Needs Arjun to pay
   every held payment               Can raise a Silent SOS.          before anyone can
   with her own face.                                                 say "wait."
        │                                 │                              │
        │ one passkey (Face ID)           │ one passkey (Face ID)        │
        ▼                                 ▼                              ▼
   ┌────────────────────────────────────────────────────────────────────────┐
   │                         COMPANION AGENT + VAULT                         │
   │  Runs the allowance, holds anything unusual, pages Kavya, fails safe.   │
   │  The rules and the guardian decide. The agent executes and connects.    │
   └────────────────────────────────────────────────────────────────────────┘
```

| Who | Role in the system | What they hold |
|---|---|---|
| **Kavya**, the parent | Guardian. Funds the family, signs the envelope, resolves holds. | One passkey (her Face ID) |
| **Arjun**, the student | Spends and receives. Proves it is him on request. | One passkey, plus a hidden duress key |
| **The relayer** | Pays gas so neither person ever needs a token. | Gas only. **No spending power.** |
| **The agent** | Runs the allowance on schedule, expires stale holds, pages the parent. | No keys that can move family money |
| **The vault** (`ThunaiVault`) | Keeps each family's balance, escrow and rules. | The family's money, accounted per family |

---

## 4. How it works, the short version

The most important flow: **a scammer's payment is stopped by a parent on another continent,
inside the time the scammer is still on the line.**

```
 Arjun's phone        Relayer          ThunaiVault        Agent / Pager       Kavya's phone
      │                  │            (Monad testnet)           │                  │
      │  1. "Send $2,000 to a new person"                       │                  │
      │  sign intent     │                  │                    │                  │
      │  (Face ID once)  │                  │                    │                  │
      │─────────────────>│                  │                    │                  │
      │                  │ 2. submit intent │                    │                  │
      │                  │─────────────────>│                    │                  │
      │                  │                  │ 3. rules: new payee│                  │
      │                  │                  │    -> money goes to│                  │
      │                  │                  │    ESCROW, not the │                  │
      │                  │                  │    payee. HoldOpened                  │
      │                  │                  │───────────────────>│                  │
      │                  │                  │                    │ 4. page Kavya    │
      │                  │                  │                    │   (push / link)  │
      │                  │                  │                    │─────────────────>│
      │ "Held for safety. We've asked Kavya."                    │                  │
      │<─────────────────│                  │                    │                  │
      │                  │                  │                    │   5. Kavya opens │
      │                  │                  │                    │      the hold and│
      │                  │                  │                    │      taps STOP IT│
      │                  │                  │                    │      (Face ID)   │
      │                  │<─────────────────────────────────────────────────────────│
      │                  │ 6. submit her passkey assertion       │                  │
      │                  │─────────────────>│                    │                  │
      │                  │                  │ 7. P256 precompile │                  │
      │                  │                  │    (0x0100) checks │                  │
      │                  │                  │    HER passkey.    │                  │
      │                  │                  │    Hold CANCELLED, │                  │
      │                  │                  │    money -> Arjun  │                  │
      │ "Stopped by Kavya. Your money is back."                  │                  │
      │<─────────────────│                  │                    │                  │
      │                  │                  │                    │                  │

   Nobody answered?  After the hold window, ANYONE can call expireHold().
   The money returns to Arjun on its own. The payee never receives it.
```

Three properties make this trustworthy:

- **The payee receives nothing at any point.** The money sits in escrow inside the vault.
- **Only Kavya's passkey can release it.** The contract verifies her WebAuthn assertion with the
  P256 precompile. The relayer only carries the signature; it cannot forge one.
- **Silence is safe.** The default outcome of "nobody answered" is *the money goes home*.

---

## 5. How it works, flow by flow

### 5.1 Setting up a family (two devices, two Face IDs)

```
   ARJUN'S PHONE                                       KAVYA'S PHONE
   ─────────────                                       ─────────────
   1. Open the app, choose "I'm the student"
   2. Enter a name
   3. Face ID  ──> creates Arjun's passkey
        │          (one passkey, three keys derived from it:
        │           account key, notes key, duress key)
        ▼
   4. Family is created onchain
   5. App shows an invite:
        [ Share on WhatsApp ]  [ Copy invite link ]
        │
        └──────── invite link over WhatsApp ───────────>  6. Kavya opens the link
                                                           7. Enters her name
                                                           8. [ Accept with Face ID ]
                                                              creates Kavya's passkey
                                                           9. She sets the envelope:
                                                              • Every week:  $150
                                                              • Ask me above: $500
                                                              • Trusted payees (rent...)
                                                              [ Approve once with Face ID ]
                                                                    │
   10. Arjun's screen flips from "Waiting"  <───────────────────────┘
       to a home screen with the next
       allowance date.
```

After this, setup never comes up again. If Arjun loses his phone, signing in with the same
passkey restores everything, because the family lives onchain and not on a server.

### 5.2 The weekly allowance (nobody touches the app)

```
                         every Sunday (the envelope's cadence)
                                      │
                                      ▼
   ┌──────────────┐   due?   ┌──────────────────┐  fund + settle  ┌────────────────────┐
   │ Agent keeper │─────────>│  ThunaiVault     │────────────────>│ Home balance (CTK) │
   │ runAllowance │          │  checks envelope │                 └─────────┬──────────┘
   └──────────────┘          │  signed by Kavya │                           │ swap
                             │  not expired     │                           ▼
                             └──────────────────┘            ┌──────────────────────────┐
                                                             │ Agora Instant Settlement │
                                                             │ CTK -> AUSD, same tx     │
                                                             │ on Agora's real testnet  │
                                                             │ CTK/AUSD pair            │
                                                             └─────────────┬────────────┘
                                                                           ▼
                                                  Arjun's spendable balance (AUSD)
                                                  "The weekly allowance from Kavya arrived."
```

The envelope Kavya signed is the only authority the agent has. It can run exactly that
amount at exactly that cadence until the envelope expires, and it advances the schedule
*before* settling so a retry can never pay twice.

### 5.3 What happens when Arjun sends money

Every send goes through the same deterministic rules. **No AI is involved in the decision.**

```
                          Arjun taps  [ Send ]
                                 │
                 signed intent: who, how much, what for
                                 │
                                 ▼
                    ┌─────────────────────────┐
                    │ Is the family paused?   │── yes ──> HOLD  (reason: paused)
                    └────────────┬────────────┘
                                 │ no
                                 ▼
                    ┌─────────────────────────┐        ┌──────────────────────────┐
                    │ Is the payee on Kavya's │── yes ─>│ Amount over her cap?     │
                    │ signed schedule?        │        └───────┬────────────┬─────┘
                    └────────────┬────────────┘            yes │            │ no
                                 │ no                          ▼            ▼
                                 │                          HOLD         PAY NOW
                                 ▼                       (over cap)   (straight through)
                    ┌─────────────────────────┐
                    │ Have other families     │── yes ──> HOLD  (reason: reported by network)
                    │ reported this payee?    │
                    └────────────┬────────────┘
                                 │ no
                                 ▼
                    ┌─────────────────────────┐
                    │ Is a "Check on Arjun"   │── yes ──> HOLD  (reason: check not answered)
                    │ still unanswered?       │
                    └────────────┬────────────┘
                                 │ no
                                 ▼
                       HOLD  (reason: new payee)
```

The order only decides *which sentence the app shows*. Every branch except "pay now" holds
the money. Payees on Kavya's signed schedule are immune to network flags, so a rent payment
is never blocked because a stranger reported the same address.

### 5.4 The life of a hold

```
                         ┌──────────────────────────┐
   Arjun's send  ──────> │  HOLD OPEN               │  money in escrow in the vault
                         │  (default window 30 min) │  the payee gets nothing
                         └───────┬──────────┬───────┘
                                 │          │
              Kavya, Face ID     │          │      nobody answers by the deadline
                                 │          │
                   ┌─────────────┘          └─────────────┐
                   │                                      │
        ┌──────────▼──────────┐                ┌──────────▼───────────┐
        │ STOP IT             │                │ EXPIRED              │
        │ status: CANCELLED   │                │ anyone (or the       │
        │ money -> Arjun      │                │ keeper) calls        │
        └─────────────────────┘                │ expireHold()         │
                                               │ money -> Arjun       │
        ┌─────────────────────┐                └──────────────────────┘
        │ ALLOW               │
        │ status: RELEASED    │       Only STOP IT, ALLOW and EXPIRE can end a hold.
        │ money -> payee      │       Only ALLOW sends money to the payee, and it
        └─────────────────────┘       needs Kavya's passkey, verified onchain.
```

After Kavya taps **Stop it**, she can tap **Report this payee**. The contract accepts a report
only for a hold that a guardian really cancelled, and only with that same guardian's passkey, so
one report costs one real family's Face ID. `ScamSignals` then raises the hold level for every
other family that tries to pay the same handle (the handle is hashed first; it is pseudonymous,
not anonymous).

### 5.5 Check on Arjun (answering a voice clone)

A cloned voice can say "Mom, it's me." It cannot hold Arjun's phone and his face.

```
   KAVYA'S PHONE                    VAULT                     ARJUN'S PHONE
   ─────────────                    ─────                     ─────────────
   taps [ Check on Arjun ]
        │ request a check
        │─────────────────────────> check opened
        │                           (a fresh challenge, a nonce)
        │                                   │ Arjun's app shows
        │                                   │─────────────────────> "Kavya wants to check
        │                                   │ the request            you're OK"
        │                                   │                        [ Face ID ]
        │                                   │                        ["I can't talk freely"]
        │                                   │<───────────────────── signed assertion,
        │                           P256 precompile verifies         bound to this exact
        │                           it came from ARJUN'S passkey     challenge
        │<───────────────────────── "Signed on his own phone"
        │                           with the real verification time
        ▼
   While the check is unanswered, new-payee sends from Arjun
   show the reason "check not answered" (see 5.3).
```

"I can't talk freely" is a second button on Arjun's check screen. It reads like an ordinary
option to anyone looking over his shoulder, but it uses the duress key to freeze every outflow
at once and tell his family, without showing anything alarming on his screen.

### 5.6 Silent SOS (money that never touches the app)

Companion cannot see a gift card bought with Arjun's own bank card. So Silent SOS breaks the
isolation instead of the payment.

```
   ARJUN (on the scam call)                                  KAVYA
   ────────────────────────                                  ─────
   taps  [ Someone is asking me for money ]
        │
        │ one discreet tap, signed with his hidden DURESS key
        ▼
   ┌─────────────────────────────────────────────────────────────┐
   │ sos(): the vault FREEZES the family.                        │
   │   • every send now holds, whatever the amount or payee      │
   │   • event SOSRaised(reason code) is recorded onchain        │
   └──────────────┬──────────────────────────────┬───────────────┘
                  │                              │
                  ▼                              ▼
   Arjun's screen:                    Kavya is paged at once
   "Your family has been told.        ┌──────────────────────────┐
    You can hang up."                 │ [ Video call Arjun now ] │ private room
   [ Video call Kavya ]  <──────────> │ [ Lift the pause ]       │ (Face ID)
   Optional: what is the caller       └──────────────────────────┘
   asking for? gift card / Zelle /
   wire / crypto / other
```

Only Kavya's passkey can lift the pause. Arjun's duress key can freeze but never unfreeze.
Even if a scammer forces Arjun to "lift" it on his own phone, the contract refuses.

### 5.7 One passkey, three keys

Arjun and Kavya each have exactly one Face ID. Behind it sit three independent keys, derived
from the passkey's PRF output with our own salt for each one:

```
                          ONE FACE ID  (WebAuthn passkey, PRF extension)
                                         │
              ┌──────────────────────────┼───────────────────────────┐
              ▼                          ▼                           ▼
   ┌─────────────────────┐   ┌─────────────────────┐   ┌──────────────────────┐
   │ thunai/acct         │   │ thunai/notes        │   │ thunai/duress        │
   │ secp256k1 account   │   │ AES-256-GCM key     │   │ secp256k1 freeze key │
   │ signs withdraw      │   │ encrypts the        │   │ registered onchain;  │
   │ intents             │   │ family's private    │   │ can freeze, can      │
   │                     │   │ notes; ciphertext   │   │ NEVER unfreeze       │
   │                     │   │ stored onchain      │   │                      │
   └─────────────────────┘   └─────────────────────┘   └──────────────────────┘

   ALSO, on every action that must be checked by the contract, the same Face ID
   produces a P256 assertion over the action hash. One tap, two proofs:
        • Mera's PRF output  -> unlocks the keys above
        • WebAuthn assertion -> verified onchain by the 0x0100 precompile
```

Why it matters: no seed phrase, no extension, no wallet app. A new phone plus the same
passkey brings the whole family back, because everything of value is derived from, or stored
under, that passkey.

### 5.8 The whole system on one page

```
   ┌───────────────┐            ┌───────────────┐
   │ Arjun's phone │            │ Kavya's phone │      Expo app, one codebase,
   │  (student)    │            │  (guardian)   │      two roles, served as a
   └───────┬───────┘            └───────┬───────┘      website at /app
           │ signed intents             │ passkey assertions
           └─────────────┬──────────────┘
                         ▼
                ┌─────────────────┐       gas only, no spending power
                │    RELAYER      │───────────────────────────────┐
                │ eth_sendRawTx   │                               │
                │ Sync (receipt   │                               │
                │ in same call)   │                               ▼
                └────────┬────────┘                ┌─────────────────────────────┐
                         │                         │      MONAD TESTNET (10143)  │
                         │   reads + events        │                             │
   ┌─────────────────┐   │                         │   ThunaiVault               │
   │ AGENT           │◄──┘                         │    envelopes, balances,     │
   │  allowance      │────────────────────────────>│    escrow holds, SOS        │
   │  keeper         │   runAllowance /            │   P256 precompile (0x0100)  │
   │  classifier     │   expireHold                │    verifies passkeys        │
   │  pager          │                             │   ScamSignals               │
   └───────┬─────────┘                             │    network reports          │
           │                                       │   Agora Instant Settlement  │
           ▼                                       │    (live: the real testnet  │
   WhatsApp link / web push                        │     CTK/AUSD pair)          │
   to Kavya's phone                                └─────────────────────────────┘
```

### 5.9 The hard rule about AI

```
          Something looks wrong
                  │
        ┌─────────▼─────────┐        ┌───────────────────────────────┐
        │ DETERMINISTIC     │        │ OPTIONAL EXPLANATION          │
        │ CONTRACT RULES    │        │ A language model reads the    │
        │ open the hold     │──────> │ situation and names the scam  │
        │ FIRST             │ after  │ script in plain English       │
        └───────────────────┘        │ ("fake officer")              │
                                     │ It can label. It cannot move  │
                                     │ or release money. Ever.       │
                                     └───────────────────────────────┘
```

If the model is down, wrong or manipulated, the hold is already open and Kavya still decides.

---

## 6. What each person sees

### Arjun (student)

| Screen | What is on it | What it is for |
|---|---|---|
| **Sign-in** | "Companion" with a small "Thunai", a name field, a Face ID button | Create the account with one passkey |
| **Invite** | **Share on WhatsApp**, **Copy invite link**, a "Waiting" pill | Bring Kavya in |
| **Home** | Balance, "Next from Kavya: Sunday $150", **Scheduled**, **Activity**, **Send**, **Our network**, **Someone is asking me for money** | The everyday screen |
| **Send** | **Someone else: their name**, **Their phone number or email** (no address, ever), **Amount**, **What's this for**, **Are you on a call right now?** (optional, in minutes), **Send** | Pay a person. Before he sends, a card says either "This one pays straight through" or "This is someone new, so we will hold it and ask Kavya first." The call length helps Kavya understand what is happening |
| **Hold** | "Held for safety. We've asked Kavya." and a live countdown | Watching Kavya decide. Money has not left |
| **Check** | **Face ID** ("Shows it's really you, right now") and **I can't talk freely** | Answering Kavya's check |
| **Silent SOS** | "Your family has been told." **Video call Kavya**, and what the caller wants | The one-tap emergency screen |
| **Details** | Signing session, **Private family notes**, "One passkey, three keys", "Under the hood", "What Companion does and does not do", **Forget this device** | Transparency, for the curious or the judge |

### Kavya (guardian)

| Screen | What is on it | What it is for |
|---|---|---|
| **Accept** | Invite code, **Your name**, **Accept with Face ID** | Join the family from the WhatsApp link |
| **Envelope** | **Every week**, **Ask me above**, trusted payees, **Approve once with Face ID** | Sign the weekly plan once |
| **Home** | Arjun's status, **Check on Arjun**, **Send money now** (testnet stand-in for the licensed partner), **Families protected** | The overview |
| **Hold** | The reason in plain words, who, how much, a countdown, **Stop it** and **Allow** (each with Face ID), and after a stop, **Report this payee** | The decision that matters |
| **Paused** | "Video call Arjun now", **Lift the pause** (Face ID) | After a Silent SOS |
| **Check** | "Waiting · 12s" turning into "Signed on his own phone, verified onchain" | The voice-clone answer |
| **Network** | Saves, allowances delivered, checks answered, reports filed. **All counted from the contracts' own events.** | Proof that it is working |

### Words you will not see

No wallet, gas, seed phrase, token, blockchain or chain ID appears on a family's screen. The
Details screen is the one place that names the machinery, deliberately, for transparency.

---

## 7. How to use it

### 7.1 As a family, step by step

**Arjun, once**

1. Open the Companion site and tap **Open the app** (it opens `/app`).
2. Enter your name and choose **I'm the student**. Approve with Face ID.
3. Tap **Share on WhatsApp** and send the invite to your parent.
4. Wait on the "Waiting" screen. It changes to your home screen as soon as Kavya accepts.

**Kavya, once**

1. Open the invite link on your phone.
2. Enter your name and tap **Accept with Face ID**.
3. Set the envelope:
   - **Every week**: the allowance amount.
   - **Ask me above**: the size of payment you want to be asked about.
   - Trusted payees: rent, school fees, anyone you already know.
4. Tap **Approve once with Face ID**. You will not do this again.

**Every week afterwards**

- The allowance arrives. Nobody does anything.

**When Arjun pays someone**

- A payee on Kavya's list, under her cap: it goes straight through.
- Anyone else: it is held, and Kavya is paged. She taps **Stop it** or **Allow**.

**When something feels wrong**

- Arjun: tap **Someone is asking me for money**, then hang up. Kavya is told, the app is
  paused, and a private video call is one tap away.
- Kavya: tap **Check on Arjun** when a call or message does not feel right. His phone must
  answer with his own face.

### 7.2 Try it in two minutes (judges and reviewers)

Open on two devices (or two browsers).

1. **Device 1.** Create as the student. Copy the invite link.
2. **Device 2.** Open the link. Accept as the guardian. Sign the envelope with one Face ID.
3. **Device 1.** Send a small amount to a brand-new person: a name and a phone number such as "+91 98765 43210". Watch it say "Held for safety."
4. **Device 2.** Open the hold. Tap **Stop it**. Device 1 shows the money back in about a second.
5. **Device 1.** Tap **Someone is asking me for money**. Device 2 shows the pause and a video call.
6. **Device 2.** Tap **Check on Arjun**. Device 1 answers with one Face ID.
7. Open **Our network** or `/traction` and see the same actions counted from the chain.

Passkeys need a secure context, so use `https://` or `localhost`. See
[`docs/DEMO.md`](docs/DEMO.md) for a three-minute script, the tunnel, and the second-device setup.

### 7.3 As a developer

```bash
pnpm install
cp .env.example .env          # fill in: MONAD_RPC_URL, three private keys, and the access tokens
pnpm contracts:test           # 95 tests, real P256 assertions
pnpm contracts:deploy         # writes contracts/deployments/10143.json
pnpm dev                      # relayer + agent + app, with a readiness report
```

Details are in [Running it](#11-running-it).

### 7.4 If something does not work

| You see | Likely cause | Fix |
|---|---|---|
| "Cannot reach Companion's server" | The relayer or agent is not running, or the site's proxy addresses are wrong | Run `pnpm dev`, then open `/relayer/health` on your host |
| Sign-in fails on a desktop browser | PRF is only returned by passkeys saved in Google Password Manager | Use that passkey type, or use a phone |
| An account made earlier is "gone" | You opened the app from a different host. A passkey works on one host only | Use the original host. Never change it |
| "Held" for a payee you trust | The payee is not on the signed schedule | Add it to the envelope next time, or have Kavya tap **Allow** |

---

## 8. What it does and what it does not

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

### Honest claims

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

## 9. Why it needs Monad

The rescue has to finish **while the scammer is still on the line.**

- **Fast finality** and `eth_sendRawTransactionSync` give a receipt in the same call, so Arjun's
  hold and Kavya's Face ID cancel are each confirmed in about a second. There are no pending
  states in the UI.
- The **P256 precompile at `0x0100`** (EIP-7951) verifies **a passkey from another continent
  inside the contract**. No server, no company and no scammer can override Kavya. This is the
  load-bearing one: without it, the guardian layer would be a server check.
- **Agora Instant Settlement** replaces a 1–3 day SWIFT transfer with a swap that settles in the same transaction. It is live on Agora's real CTK/AUSD pair on Monad testnet: every allowance and deposit in our latest run settled through it.

```
   Time from "tap" to "confirmed" on Monad testnet (measured, pnpm e2e:testnet)

   fastest   0.30 s  ██████
   median    0.53 s  ███████████
   slowest   0.92 s  ██████████████████
                     0       0.5      1.0      1.5 s
```

**Measured on live Monad testnet** (`pnpm e2e:testnet`, 23 confirmed transactions): median **0.53 s**, fastest 0.30 s, slowest 0.92 s, run through the deployed site and relayer. Raw numbers are in [`docs/e2e-testnet.json`](docs/e2e-testnet.json), and the traction page lists the latest transactions with explorer links. No other latency figure is quoted anywhere.

---

## 10. Architecture

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
                                   │ passkey-signed   │   │ Settlement (live,   │
                                   │ reports          │   │ real testnet pair)  │
                                   └──────────────────┘   └─────────────────────┘
```

The app reads the contract and the relayer directly. There is no indexer in the running system.

| Folder | What's in it |
|---|---|
| [`contracts/`](contracts) | `ThunaiVault.sol`, `ScamSignals.sol`, 95 Foundry tests (including a fork test against the real Agora pair), deploy script |
| [`relayer/`](relayer) | Gas sponsorship, `eth_sendRawTransactionSync`, intent API |
| [`agent/`](agent) | Allowance runner, keeper, classifier, pager |
| [`cre/`](cre) | A Chainlink CRE workflow that reads the vault on Monad testnet and drives the allowance and the unanswered holds through the agent. `cre workflow simulate` passes against the live chain; output in [`docs/cre-simulation.txt`](docs/cre-simulation.txt). Not deployed to the CRE network. |
| [`indexer/`](indexer) | The Envio HyperIndex 3 indexer (config, schema with derived entities, handlers). **Live on Envio Cloud**; `/traction` and the app read it. |
| [`app/`](app) | Expo app — both roles, every screen |
| [`frontend/`](frontend) | The landing page (Next.js). Its numbers come from a recorded run on testnet. |
| [`packages/shared`](packages/shared) | Chain config, ABIs, action hashes, merkle trees, copy-safe money formatting |
| [`packages/evm`](packages/evm) | Vault bindings shared by relayer and agent |

**Who custodies what:** the family's money sits in `ThunaiVault`, accounted per family,
because escrow *is* the feature. No server key can move it. Outflows need Arjun's signature
plus contract rules, and anything held needs Kavya's passkey. *No company can move your money,
including us.*

```
   WHO CAN DO WHAT
   ───────────────────────────────────────────────────────────────────────
                          Arjun    Kavya    Relayer   Agent    Anyone
   Send to trusted payee    ✔        ·         ·        ·        ·
   Send to new payee        opens a hold (money stays in escrow)
   Release a hold           ·        ✔         ·        ·        ·
   Cancel a hold            ·        ✔         ·        ·        ·
   Expire a stale hold      ·        ·         ·        ✔        ✔
   Run the allowance        ·        ·         ·        ✔        ·
   Freeze (SOS)             ✔ (duress key)    ·        ·        ·
   Lift the freeze          ·        ✔         ·        ·        ·
   Pay gas                  ·        ·         ✔        ·        ·
```

Money only ever moves to a payee through Arjun's signature plus the rules, or through
Kavya's passkey. Nothing else can.

---

## 11. Running it

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
every account made on the old one is unreachable. The permanent host is **https://companion-monad.vercel.app**; for local
development use `localhost`, and for a phone test a reserved tunnel domain, never a random one that changes. Passkeys need
HTTPS (or `localhost`), and the relayer and agent must be HTTPS too when the app is, or the browser blocks the calls.

The landing page and the app are **one site** (`/` and `/app`), and the site proxies the relayer and agent at
`/relayer` and `/agent`, so there is one host to keep:

```bash
pnpm web:dev          # exports the app into the site, then serves it on http://localhost:3000 (app at /app)
```

```
APP_URL=https://your-permanent-host/app
```

`pnpm dev` checks the URLs on startup and warns if the app origin is not HTTPS or localhost, or if the host is not local (a
reminder that it must never change). The app also says so on its first screen.

**Where it runs.** The site (landing page and `/app`) is on Vercel. The relayer and agent run as one always-on service on Render
(`render.yaml`, `scripts/serve.mjs`), and the site proxies `/relayer` and `/agent` to it. [`docs/DEPLOY.md`](docs/DEPLOY.md) has the
steps, including tunnelling for a phone test.

```
   https://<site>/            the landing page
   https://<site>/traction    live counts from the chain
   https://<site>/app         the Companion app (an Expo web build served as static files)
   https://<site>/relayer/*   proxied to the relayer
   https://<site>/agent/*     proxied to the agent
```

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

```
   pnpm e2e : the scene it plays, in order

   onboard ─> allowance ─> rent pays itself ─> new payee HELD ─> Kavya CANCELS
      │                                                              │
      │                                                              ▼
   push enrolment <─ lock-down checks <─ encrypted notes <─ Silent SOS <─ liveness
                                                                         check
        ... plus the fail-safe expiry and the network warning, with an
            assertion after every step that the payee received nothing.
```

### Judge instructions

Open on two devices. **Device 1:** create as the student → copy the invite link.
**Device 2:** open the link → accept as the guardian with one Face ID → sign the envelope.
Then send a small amount to a new person (a name and a phone number) from Device 1 and watch Device 2.

Passkeys need a secure context, so use `https://` or `localhost`. See [`docs/DEMO.md`](docs/DEMO.md) for the tunnel and the second-device setup.

---

## 12. Deployed addresses

`contracts/deployments/10143.agora.json` is the source of truth (`THUNAI_DEPLOYMENT=agora`). Monad testnet, chain 10143.

| Contract | Address |
|---|---|
| `ThunaiVault` (the app's vault, Agora Instant Settlement on) | `0xF2BA20FaF5f171DcDB9E7F70a489855d170465C1` |
| `ScamSignals` | `0x9d2a0Fbf98E9e2F3B2EE2C1A8E9525B3001614A8` |
| CTK (Agora's testnet token, 18 decimals) | `0x7BEb5D9DB0d85cBEa543C04f0dE8c23c2176cd9D` |
| AUSD (Agora's testnet token, 6 decimals) | `0xa9012a055bd4e0eDfF8Ce09f960291C09D5322dC` |
| Agora CTK/AUSD pair | `0x1Aa8958Aa34cEC8096EF4381cb335effe977b0ae` |
| Agora testnet Whitelister | `0x7c10F56d6f04a51376393a1C3670e966863F6BD5` |
| Earlier vault on stand-in tokens (retired; the landing page's recorded run used it) | `0x3aC3F87d6713390aCfeD85133Ca662d7a2ADCf87` |
| ERC-8004 identity registry (agent **#2187**) | `0x8004A818BFB912233c491871b3d84c89A494BD9e` |
| P256 precompile | `0x0000000000000000000000000000000000000100` |

---

## 13. Track and bounties

**Track: Consumer Products & Payments.** An end-user app for a student and a parent, with no crypto
word on their screens.

- [**Agora** — cross-border payments](docs/SUBMISSION.md#agora)
- [**Mera** — best Mera-powered UX](docs/SUBMISSION.md#mera-ux)
- [**Mera** — one passkey, many keys](docs/SUBMISSION.md#mera-many-keys)
- Best Community Team (selected on our hackathon profile)

[Chainlink CRE](docs/SUBMISSION.md#chainlink-cre): the workflow simulates successfully against the live chain and the deployed agent.

[Alchemy](docs/SUBMISSION.md#alchemy): a failover RPC (verified) and a webhook that pages the parent from the chain itself (built and tested; awaiting a real delivery).

[Envio](docs/SUBMISSION.md#envio): the indexer is live on Envio Cloud, and the traction page and the app read it.

Not entered: Dynamic and Privy (they would replace Mera as the account layer), Cleanverse, Nansen, Aurora, Kuru, Perpl, Agora
Trading, MetaMask and Hunyuan. [`docs/STATUS.md`](docs/STATUS.md) lists exactly what is verified, unverified and not done.

One finding worth reading in [`docs/SUBMISSION.md`](docs/SUBMISSION.md): how one Face ID is made to
serve both Mera's PRF and the contract's WebAuthn verification.

---

## 14. Honest limits

Stated here rather than discovered by a judge.

- **Testnet only.** The money is Agora's testnet CTK and AUSD, which have no real value.
- **The vault was approved through Agora's testnet self-service.** On testnets Agora runs a Whitelister anyone may call; on
  mainnet, approval needs Agora's KYC. The relayer's CTK came from Agora's AUSD faucet, swapped on the pair, because Monad
  testnet has no CTK faucet.
- **The swap sets no minimum output.** Our vault calls the pair with `amountOutMin` 0. At the pair's fixed 1:1 testnet price
  that is harmless (every swap returned what it put in), but a mainnet vault should take a quote from `getAmountsOut` as the
  floor, as Agora's guide does. It would need a redeploy, so it is listed here instead.
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
- **The indexer is on Envio Cloud's free development plan.** If it is gone, the counters fall back to our relayer's own count, and
  the screens say which source they used.
- **PRF notes key on a real phone is unverified.** The notes are encrypted and stored onchain and the round trip is
  tested, but with a stand-in for the authenticator's PRF output.
- **Nothing on the landing page is invented.** Every figure is from a recorded run with a transaction
  hash. The family in that run is fictional.
- **No real families yet.** The traction page reports zero real families and separates our own test runs.

---

## 15. Business model

Companion earns a small FX/transfer spread on each allowance — the same model remittance
companies use. The guardian layer is free, and it is why families stay.

```
   Kavya funds the allowance ──> small spread on the cross-border transfer ──> Companion revenue
                                      │
                                      └── the protection (holds, checks, SOS) costs the family nothing,
                                          and is the reason they stay
```

[mea]: https://www.business-standard.com/immigration/75x-jump-in-scams-hits-indians-in-us-amid-visa-crackdown-govt-data-126040600784_1.html
[wion]: https://www.wionews.com/world/indian-student-in-us-becomes-victim-of-digital-arrest-scam-loses-5-000-to-scammers-posing-as-ice-officers-here-s-what-happened-1749373803522/amp
[od]: https://gradright.com/news/india-tops-open-doors-2025-international-students-usa/
[df]: https://insights.dataful.in/articles/travel-drives-indias-lrs-outflows-as-education-remittances-moderate
