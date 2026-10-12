# Agora whitelist request

> **No longer needed on testnet.** Agora's docs describe a self-service Whitelister on every testnet (`0x7c10F56d6f04a51376393a1C3670e966863F6BD5`). On 12 Oct we used it
> (`scripts/agora-testnet-setup.mjs`) and turned Instant Settlement on ([tx](https://testnet.monadexplorer.com/tx/0xa74d41207fb028551fcec60ff9b4fee0aed9f39e7fa151dd90b98ffa94c65622)). The request below is kept for a
> mainnet conversation, where approval goes through Agora's KYC.

Ready to paste into the Agora bounty channel. Every address below is deployed on Monad testnet
(chain 10143) and can be checked with `pnpm agora:check`.

---

**Subject: APPROVED_SWAPPER request for Companion's vault (Best Cross-Border Payments App)**

Hi Agora team,

We are building **Companion**, a family money agent for Indian parents with a child studying
abroad. The weekly allowance should cross the border in about a second, so we want to settle it
through the CTK/AUSD Instant Settlement pair on Monad testnet. The pair's swap is gated by
`APPROVED_SWAPPER`, so could you grant that role to our vault?

**The address to whitelist (the contract that calls `swapExactTokensForTokens`):**

| | Address |
|---|---|
| **Companion vault (`ThunaiVault`), Agora-ready** | `0xF2BA20FaF5f171DcDB9E7F70a489855d170465C1` |

**Context, so you can check our work:**

| | Address |
|---|---|
| Pair we integrate with | `0x1Aa8958Aa34cEC8096EF4381cb335effe977b0ae` (name "CTK/AUSD", price 1.0) |
| Factory | `0x8468587Af422ad440F58a57E955eCA6A970b5375` |
| CTK (18 decimals) | `0x7BEb5D9DB0d85cBEa543C04f0dE8c23c2176cd9D` |
| AUSD (6 decimals) | `0xa9012a055bd4e0eDfF8Ce09f960291C09D5322dC` |
| Our `ScamSignals` (companion contract) | `0x9d2a0Fbf98E9e2F3B2EE2C1A8E9525B3001614A8` |
| Relayer (pays gas, holds no authority over funds) | `0x3Ba85544C7a5C386AE7Cf753e887FB05Ac946074` |
| Keeper agent | `0x301ea090e957c28ca536ab8679EBEF2D354Febd8` |
| Deployer / owner | `0xac13a62FC7E50d08945ba2e79B5Eaa190d8D7D9a` |

**What the vault does with the pair:**

- On a deposit it calls `swapExactTokensForTokens(amountIn, 0, [CTK, AUSD], vault, deadline)` and
  credits the student with the AUSD it actually received (measured by balance difference).
- It already approves the pair for CTK, converts CTK's 18 decimals to AUSD's 6, and wraps the swap in
  `try/catch`, so a refused swap can never revert a family's deposit.
- Until the role is granted the vault credits from a pre-funded AUSD float and says so in the app
  ("Agora Instant Settlement: off (disclosed fallback)"). It refuses to credit AUSD it does not hold.

**How we checked we are not whitelisted yet:** `pnpm agora:check` simulates a zero-amount swap from
the vault with `eth_call` and reads the pair's revert. It currently fails with the pair's
missing-role error (selector `0xc13dd0f3`, role `0x20`), and we will re-run it the moment you confirm.

**Two small asks, if possible:**

1. `APPROVED_SWAPPER` for `0xF2BA20FaF5f171DcDB9E7F70a489855d170465C1`.
2. A little test CTK sent to the relayer (`0x3Ba85544C7a5C386AE7Cf753e887FB05Ac946074`) so we can
   demonstrate a live swap. We cannot mint it ourselves: the CTK `mint` is owner-only.

Thank you. We will show the swap live in our demo as soon as it is approved.

Companion team

---

## Notes for us (not part of the request)

- **Switching the app to it is one setting:** `THUNAI_DEPLOYMENT=agora` in `.env` selects `10143.agora.json` (vault, ScamSignals, both tokens and the Agora flag together). The order is: Agora whitelists the vault, then `pnpm agora:enable` (it refuses to run until `pnpm agora:check` passes), then set `THUNAI_DEPLOYMENT=agora` and `THUNAI_START_BLOCK=70125617`, restart `pnpm dev`, send the relayer the real CTK, re-run `pnpm e2e:testnet`, and record the Agora video on that vault.
- The vault in the request is **not** the one the running app uses. The app's vault is built on our
  labelled stand-in tokens, so we can fund demos freely. Once Agora approves the Agora-ready vault we
  point `THUNAI_VAULT_ADDRESS` at it, send it real CTK, and set `AGORA_ENABLED=true`
  (`setAgora(pair, true)` on the vault).
- The path is tested three ways: against a mock pair (including 18-decimal CTK), against the real pair
  on a fork (`MONAD_FORK_URL=... forge test --match-contract RealAgoraFork`), which proves the real pair
  refuses an unapproved vault and our fallback survives it, and by `pnpm agora:check` against the live
  chain. What cannot be tested until Agora acts is a swap that succeeds on the real pair.
