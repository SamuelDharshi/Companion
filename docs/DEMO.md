# Demo

Two real phones, one scene. Everything below runs against the live product, with no mock-ups. If a step does not
work on the day, say so on camera rather than editing around it: `docs/STATUS.md` lists what is unverified.

## Before you record

```bash
pnpm install
cp .env.example .env            # fill in MONAD_RPC_URL, three funded keys, and the tokens (see below)
pnpm contracts:test             # 95 tests should pass
pnpm contracts:deploy           # only if you need a fresh vault
pnpm dev                        # relayer, agent and app; prints which features are live
```

`pnpm dev` prints a readiness report and **warns about URLs that would break passkeys**. Read it before recording.

**The one rule that bites: a passkey is tied to one host.** Create accounts on `https://your-permanent-host` and always
open the app from exactly that host. Change it and every account made on the old one is unreachable. Use a **reserved
ngrok domain or a Vercel URL**, never a random one that changes. Passkeys need HTTPS or `localhost`.

The landing page and the app are **one site**: `https://your-permanent-host/` is the landing page and
`https://your-permanent-host/app` is the app, with the relayer and agent proxied at `/relayer` and `/agent`. Build and
serve it, tunnel the one port, and set where alerts and invites should point:

```bash
node scripts/build-web.mjs --next        # exports the app into the site and builds it
cd frontend && pnpm exec next start -p 3000
ngrok http 3000                          # a reserved domain, so the host never changes
```

```
APP_URL=https://your-permanent-host/app
```

See [`docs/DEPLOY.md`](DEPLOY.md) for the details, and for deploying the same thing on Render.

Also set `DEV_ADMIN_TOKEN`, `INTERNAL_TOKEN` and `TESTNET_PARTNER_STANDIN=true` (see `.env.example`). Without them
"Send money now" is off and the dev endpoints do not exist.

### Dry run, no phones

```bash
pnpm e2e            # 15 beats on a private local chain
pnpm e2e:testnet    # the same scene on live Monad testnet, fresh random keys, records timings
```

If these pass, the product works. The phones are only there to make it visible.

---

## The 3-minute main demo

| Time | Beat | On screen |
|---|---|---|
| 0:00 | **Open on Kavya** | Her phone shows "Arjun needs you". Then rewind: "Ten seconds earlier, in Indiana..." |
| 0:10 | Problem | 8 to 613 complaints. Shreya's words: "kept me on the phone for three hours... I couldn't call anyone." |
| 0:25 | Setup | Arjun: Face ID, invite Kavya, WhatsApp, her phone opens, one Face ID, she signs the allowance. Two real phones. |
| 0:45 | Autopilot | On Kavya's phone tap **Send money now**. It lands on Arjun's home screen. Point at the **How fast** card: the bank's 2-3 business days against the seconds **this phone measured**. |
| 1:05 | **The main moment** | A teammate on speaker plays the ICE officer. Arjun sends a "bond" to a new address. **Held for safety** appears, Kavya's phone buzzes, **Stop it**, Face ID, "Kavya stopped this. The money is back." Arjun never "called anyone". |
| 1:40 | **Silent SOS** | Arjun taps **Someone is asking me for money**. His money pauses, Kavya's screen shows the SOS with **Video call Arjun now**. Line: *"It works for gift cards and Zelle too, because it breaks the isolation."* |
| 2:05 | Check on Arjun | Play a cloned voice: "Kavya, I've been arrested." She taps **Check on Arjun**, and the screen says "Don't send money to anyone until this shows a signature." His phone answers. Line: *"A voice can be cloned. A passkey can't."* |
| 2:25 | Stateless | Details, **Forget this device**, one Face ID, everything is back, including the private notes. |
| 2:40 | Close | The landing page's **Verify it yourself** table: real transactions with links. Then `/traction`. *"Companion: family is your second key."* |

### Lines to say exactly

- "The rules and the guardian decide. The agent executes, explains and connects."
- "Monad's precompile verifies Kavya's passkey **inside the contract**. No server, no company and no scammer can override her, including us."
- "If nobody answers, the money goes back to Arjun. Never to the payee."
- "A voice can be cloned. A passkey can't."
- "Network reports raise the hold level. They never block on their own."
- "It protects money held in the app. For everything else, one tap breaks the isolation the scam depends on."

### Lines never to say

See the honest-claims table in the [README](../README.md#honest-claims). In particular: not "clawback", not "protects his bank
account", not "proves he's safe", not "AI detects scams", and nothing implying a resident Indian buys crypto. Do not quote a
latency other than the measured ones in `docs/e2e-testnet.json`.

---

## 2-minute bounty videos

### Agora (passkey onboarding, AUSD balance, instant send and receive)

1. **0:00** Create the student account: one Face ID. No seed phrase, no email.
2. **0:20** Kavya accepts the invite and signs the allowance.
3. **0:40** Show Arjun's balance in **dollars**. Kavya taps **Send money now**; it arrives and the **How fast** card shows the measured seconds.
4. **1:10** Details: "Agora Instant Settlement: off (disclosed fallback)". Say it plainly: the swap is built, our vault is not whitelisted yet, and the vault uses a pre-funded float it will not over-credit.
5. **1:30** Run `pnpm agora:check` on screen: the vault is built on the real CTK and AUSD, handles the 18-decimal CTK, and the pair refuses an unwhitelisted vault. Show `docs/AGORA_REQUEST.md`.

### Mera UX (one ceremony, scoped session, stateless test)

1. **0:00** Sign up: one Face ID creates the account and the duress key together.
2. **0:30** Details: "Session active · 14 min". Send to an approved payee with no prompt. Then stop a held payment: it **always** asks for Face ID. Say why.
3. **1:10** Let the session end: the **Tap Face ID to continue** panel with one button.
4. **1:30** **Forget this device**, then one Face ID: the same family, envelope and notes come back from the chain.

### Many Keys (namespace table and cross-device test)

1. **0:00** Details, "One passkey, three keys": show the account key, the notes key and the duress key, each with its own salt.
2. **0:35** Save a private family question: encrypted on the phone, stored as **ciphertext in the vault contract**. Show it on the explorer.
3. **1:10** Open the app on a **second device** with the same passkey: the same addresses, and **Open my notes with Face ID** reads the question back.
4. **1:40** Silent SOS signs with the duress key: it can only stop things, and only Kavya's passkey lifts it.

If the PRF-derived notes key has not been shown working on a phone before you record, **say so on camera**.

### Envio

Do not record unless the indexer is live and the app's Details says "Envio indexer". If it is not, the honest line is the one
in the submission: included, not deployed.

---

## 2-minute pitch outline

1. **Team** (10 s): LICET, Chennai. "Our seniors are Arjun."
2. **Problem** (25 s): 8 to 613 complaints. A student alone on a call for three hours.
3. **Insight** (15 s): isolation is the weapon, so make family the second key.
4. **Product** (30 s): weekly allowance, a hold the parent can stop with Face ID, Check on Arjun, Silent SOS.
5. **Why new, why Monad** (20 s): a bank's trusted-person idea works inside one bank; Companion works across borders. Monad's precompile verifies a passkey from another continent inside the contract, and a confirmation takes about 1.2 seconds (median 1.23 s measured).
6. **Traction and next** (20 s): the `/traction` numbers, honestly split into real families and our own tests. Roadmap: a licensed LRS partner, mainnet, Telugu and Hindi.

---

## Setting up the second family

Family B is a third device or a second browser profile with its own passkey. Create it as a student and accept as a
guardian. Family A must have **cancelled** a hold and filed a report (the report button appears only after a cancel, because
the contract will not accept a report without one). Then send from family B to the same address: it is held with the network
reason.

## If something fails mid-demo

| Symptom | What it means | What to do |
|---|---|---|
| "This device cannot use passkeys" | No secure context, or no PRF support | Use `https://` or `localhost`; switch to a known-good phone |
| "PRF unavailable" on a desktop | Desktop Chrome returns PRF only for passkeys saved in **Google Password Manager** | Use a phone, or save the passkey to Google Password Manager |
| "Send money" or alerts fail with "relayer is low on MON" | The relayer fell near Monad's 10 MON reserve | Top up the relayer from the faucet and keep it above about 12 MON |
| Face ID prompt appears twice | The authenticator did not evaluate PRF at creation | Expected on some devices; Mera runs a fallback assertion |
| "Cannot reach Companion's server" | The relayer or agent behind the site is down, or `RELAYER_URL` and `AGENT_URL` on the site are wrong | Check `pnpm dev` is running and open `/relayer/health` on your host |
| "This page is secure but the server address is not" | Only possible with the standalone Expo server: the app is HTTPS and its relayer URL is HTTP | Use the site build, which calls `/relayer` on its own origin |
| An old account no longer works | The host changed, so the passkey is out of scope | Use the original host, or create a new account |
| "Send money now" is missing or fails | `TESTNET_PARTNER_STANDIN` is off, or the session ended | Set it to `true`, or tap Face ID to continue |
| A hold does not page Kavya | No push subscription yet | She still gets the WhatsApp link; or tap **Turn on alerts** on her phone first |
| Latency reads higher than expected | The RPC has no `eth_sendRawTransactionSync` | Details says "polling". Quote only measured numbers |

The product is designed so every failure above degrades into "the money is still held and still comes back", which is the
one property worth protecting on stage.
