# Agora Instant Settlement

Companion settles every allowance and every deposit into a family's account through Agora's CTK/AUSD Instant Settlement pair on
Monad testnet, in the same transaction that moves the money. This page explains how it is set up and how to keep it running.

## The pieces

| What | Address (Monad testnet, chain 10143) |
|---|---|
| Our vault (`ThunaiVault`), Agora on | `0xF2BA20FaF5f171DcDB9E7F70a489855d170465C1` |
| Agora CTK/AUSD pair | `0x1Aa8958Aa34cEC8096EF4381cb335effe977b0ae` |
| CTK (18 decimals) | `0x7BEb5D9DB0d85cBEa543C04f0dE8c23c2176cd9D` |
| AUSD (6 decimals) | `0xa9012a055bd4e0eDfF8Ce09f960291C09D5322dC` |
| Agora testnet Whitelister | `0x7c10F56d6f04a51376393a1C3670e966863F6BD5` |
| Agora AUSD faucet | `0xd236c18D274E54FAccC3dd9DDA4b27965a73ee6C` |

All of these come from Agora's documentation ([Protocol Deployments](https://docs.agora.finance/instant-settlement/protocol-deployments),
[Contract Deployments](https://docs.agora.finance/developer/contract-deployments)) and `contracts/deployments/10143.agora.json`.

## How money moves

```
 parent's deposit (CTK, from the remittance partner)
        │
        ▼
 ThunaiVault.fundAndSettle / runAllowance
        │  swapExactTokensForTokens(amountIn, 0, [CTK, AUSD], vault, deadline)   ← Agora pair, same transaction
        ▼
 AUSD credited to the student, measured by the vault's own balance change
        │
        ▼
 event Payout(familyId, amountIn, amountOut, viaAgora = true, timestamp)
```

The vault keeps family money in 6-decimal dollars and converts CTK's 18 decimals at the edge. The swap is wrapped in `try/catch`,
and the vault refuses to credit AUSD it does not hold (`UnbackedCredit`), so a refused swap can never fail a family's deposit or show a
balance the vault could not pay.

## Setting it up (already done; safe to run again)

```bash
node scripts/agora-testnet-setup.mjs     # or: pnpm agora:setup
pnpm agora:check                         # must end with "Ready"
pnpm agora:enable                        # turns the swap on for the vault (owner key)
```

`agora-testnet-setup.mjs` follows Agora's testnet guides ("Executing a Swap", "Getting Testnet Tokens"). Each step checks before it acts:

1. **Approval.** Calls the Whitelister's `setApprovedSwapper` for the vault and for the relayer. On mainnet this is Agora's KYC instead.
2. **AUSD.** Asks Agora's faucet for test AUSD for the relayer.
3. **CTK.** Monad testnet has no CTK faucet, so the relayer swaps AUSD into CTK on the pair (1:1).
4. **Allowance.** Lets the vault pull the relayer's CTK when a family is funded.

Then `THUNAI_DEPLOYMENT=agora` (with `THUNAI_START_BLOCK=70125617`) points the relayer, agent, indexer and CRE workflow at this vault.
On Render it is in `render.yaml`; locally it is in `.env`.

## Topping up the relayer's CTK

Every "Send money now" and every allowance spends the relayer's CTK. To check and top up:

```bash
CTK_TARGET=6000 node scripts/agora-testnet-setup.mjs
```

It only swaps the shortfall. If it stops with `MaxFrequencyExceeded`, the faucet's rate limit applies: wait a few minutes, or set a
lower `CTK_TARGET` that the AUSD already held can cover.

## Checking it is really Agora

- The app's **Details** screen says "Agora Instant Settlement: on", read from the vault itself.
- On the explorer, every `Payout` event of the vault has `viaAgora = true`.
- The live traction page (Envio) counts settlements "through Agora" against "through the fallback".

## Known limit

The vault calls the pair with `amountOutMin` 0. At the testnet's fixed 1:1 price that is harmless (every swap so far returned the
amount put in), but a mainnet vault should take a quote from `getAmountsOut` as the floor, as Agora's
[fixed-input swap guide](https://docs.agora.finance/instant-settlement/guides/executing-swap/swapping-fixed-input) does. It needs a
contract redeploy, so it is disclosed instead.
