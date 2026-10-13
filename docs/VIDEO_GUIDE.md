# Video guide: what to show for each sponsor, with real data

Every number and link below is real, read from the live system on 13 October 2026. Numbers grow as you test, so read them
again on camera rather than typing them in. Never write "N families" or placeholders: show the screen that has the number.

## Before any recording

1. Open https://companion-monad.vercel.app/relayer/health and wait for `"ok":true` (wakes the server).
2. **Student and parent must be in different browsers or devices** (student: your phone; parent: your computer or a second phone).
3. Do not push code while recording: a push restarts the server and wipes family names and pending invites.
4. Order matters: money in → send to a new person (held) → Stop it → Check on Arjun → Silent SOS **last** (it pauses everything).

## Real data you can show (13 Oct 2026)

| What | Value | Where to show it on camera |
|---|---|---|
| Families on the vault | 13 | App → **Our network**; Envio playground; CRE log |
| Payments held | 41 | same |
| Payments a parent stopped | 13 | same |
| Returned because nobody answered | 28 | same |
| Settlements through Agora / through the fallback | **18 / 0** | App → **Our network** ("Settled through Agora") |
| Checks requested / answered | 14 / 6 | App → **Our network** |
| Payees reported to the network | 12 | same |
| Silent SOS presses | 14 | same |
| Median / fastest time for a parent to stop a payment | 4 s / 1 s | same |
| A $3,000 deposit settled through Agora | `viaAgora = true` | https://testnet.monadexplorer.com/tx/0x1996e78bc075dcfe4d4fbc97415ea2e21be794ec27e2aa561bd7e2822b43905b |
| A $2,000 scam payment stopped by a parent in 4 s | hold 35 | https://testnet.monadexplorer.com/tx/0x821bb4269210bde48b5ba9c1a042f6f39db82983576118ffba064364a0c5b8e4 |
| The vault (Agora on) | `0xF2BA20FaF5f171DcDB9E7F70a489855d170465C1` | https://testnet.monadexplorer.com/address/0xF2BA20FaF5f171DcDB9E7F70a489855d170465C1 |

---

## 1. Main track demo (Consumer Products & Payments), 3:00 maximum

Must show the product **actually running** and **Monad transactions** (rules 9.1, 9.4). Mostly real screen recordings.

| Time | Show | Say |
|---|---|---|
| 0:00 | Landing page with the 3D globe | "Companion: family is your second key." |
| 0:10 | Student: **Create with Face ID**, share invite. Parent: **Accept with Face ID**, **Approve once with Face ID** | "One Face ID each. No wallet, no seed phrase." |
| 0:40 | Parent: **Send money now**; student's balance rises | "The allowance settles through Agora on Monad in about half a second." |
| 1:00 | Student: **Send** $20 to Ravi Kumar (+91 98765 43210), "immigration bond" → **Held for safety** | "Someone new, so the money pauses and the parent is asked." |
| 1:25 | Parent: **Stop it** with Face ID → student sees money back | "Her Face ID is checked inside the contract. The payee got nothing." |
| 1:50 | Parent: **Check on Arjun**; student answers with Face ID | "A voice can be cloned. A passkey can't." |
| 2:10 | Student: **Someone is asking me for money**; parent: SOS card, then **Lift the pause** | "SOS freezes all money until the parent lifts it." |
| 2:35 | App → **Our network** (real counts), then the explorer link of the stopped payment | "Every number here is an on-chain event." |
| 2:50 | End card | companion-monad.vercel.app |

---

## 2. Agora: Best Cross-Border Payments App (2:00)

**What proves you use Agora's ecosystem:** AUSD (Agora's stablecoin), the **Instant Settlement pair** (CTK→AUSD in the same transaction),
the **testnet Whitelister** (the vault is an approved swapper), and the **AUSD faucet**.

| Step | Show | Real data |
|---|---|---|
| 1 | Passkey onboarding (student and parent) | — |
| 2 | Parent taps **Send money now**; student's **AUSD balance** (dollars) rises | — |
| 3 | Student → **Details**: the pill **"Agora Instant Settlement: on"** | read from the vault |
| 4 | Explorer: the deposit transaction → `Payout` event `viaAgora = true`, swap through pair `0x1Aa8958A…` | tx `0x1996e78b…` (link above) |
| 5 | App → **Our network**: "Settled through Agora **18**", "through the fallback **0**" | live |
| 6 | Terminal: `pnpm agora:check` → ends with **Ready** (vault passed the pair's role gate) | live |
| 7 | Say: "Approved through Agora's testnet Whitelister; on mainnet that's Agora's KYC." | — |

---

## 3. Mera: Best Mera-Powered UX (2:00)

**What proves Mera is the whole account layer:** one passkey ceremony, a scoped signing session, re-prompts for big actions, the
stateless test, and gas paid for the user.

| Step | Show |
|---|---|
| 1 | Parent from invite link: **Accept with Face ID** → **Approve once with Face ID** (2 taps). Say: "confirmed on Monad in about half a second." |
| 2 | Student → **Details**: **"Session active · N min"** (read the real minutes on screen) |
| 3 | Student **Send** to a new person: **no Face ID prompt** (session) |
| 4 | Parent **Stop it**: Face ID **always** asked |
| 5 | (If you can wait 15 min) the **"Tap Face ID to continue"** panel |
| 6 | Student → **Details → Forget this device** → reopen `/app` → **I already use Companion** → Face ID → same family and balance |

---

## 4. Mera: One Passkey, Many Keys (2:00)

**What proves non-wallet use of PRF keys:** three keys from one passkey, each from its own salt; the notes key encrypts; the duress key
only freezes.

| Step | Show |
|---|---|
| 1 | Student → **Details → One passkey, three keys**: account, notes and duress, each with its salt |
| 2 | **Private family notes**: type a note → **Save with Face ID** |
| 3 | Same passkey on a second device (or after **Forget this device**): the same three keys appear; **Open my notes with Face ID** shows the same note |
| 4 | Student: **Someone is asking me for money** (signed by the duress key) → family paused; only the parent's **Lift the pause** reopens it |

---

## 5. Chainlink CRE (2:00)

**What proves CRE orchestrates:** a CRE workflow reads the vault on Monad and decides what to do; the agent acts.

| Step | Show | Real output |
|---|---|---|
| 1 | `cre/companion-orchestrator/main.ts`: cron trigger, EVM read (Multicall3), HTTP call | — |
| 2 | Terminal, from the `cre` folder: `cre workflow simulate companion-orchestrator --target staging-settings --non-interactive --trigger-index 0` | "Read Monad testnet: **13 families, 41 holds**", "Checked 13 allowances and 25 recent holds in one read", "Workflow Simulation Result" |
| 3 | Point out the numbers match the Envio playground and the app's **Our network** | 13 / 41 |
| 4 | To show an action: in the app, send to a new person (held), wait **2 minutes**, run the simulation again | "Hold N still waiting after …s: parent reminded" |
| 5 | Say the limit: CRE reads on-chain and acts through our agent; the vault has no CRE receiver yet | — |

If the terminal says you're logged out, run `cre login` first.

---

## 6. Envio (2:00)

**What proves Envio drives a feature:** a deployed HyperIndex indexer, and the app reading it.

| Step | Show | Real data |
|---|---|---|
| 1 | `indexer/config.yaml` (Monad 10143, the vault, 16 events), `schema.graphql`, `src/EventHandlers.ts` | — |
| 2 | Open https://indexer.dev.hyperindex.xyz/228e4fb/v1/graphql and run `query { NetworkStats { families holdsOpened scamsStopped payoutsViaAgora sosRaised medianSaveSeconds } }` | 13, 41, 13, 18, 14, 4 |
| 3 | App → **Our network**: the same numbers, read from Envio | same |
| 4 | Stop a payment in the app, refresh: the count goes up by one | live |

---

## 7. Alchemy: not recommended now

Alchemy's free monthly quota is used up, so the failover can't be shown working (the app falls back to Monad's public RPC instead),
and the vault-filtered webhook has not fired. Skip this bounty unless you create a new Alchemy account with fresh quota.
