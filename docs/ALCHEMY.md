# Alchemy on Monad testnet

Alchemy supports Monad testnet (RPC, websockets and webhooks). Companion uses it in two ways, and does **not** use it for
event-log counting, because Alchemy's free tier allows only 10 blocks per `eth_getLogs` request.

| Use | What it does | Status |
|---|---|---|
| **Failover RPC** | The relayer and the agent send every request to `MONAD_RPC_URL` first. If that errors, the same request is retried on Alchemy (`ALCHEMY_RPC_URL`), including the synchronous send, so one provider's outage cannot stop a rescue. | Verified: `pnpm check:failover` |
| **Chain-driven alerts** | An Alchemy webhook watches the vault for `HoldOpened` and `SOSRaised` and calls the agent at `/alchemy/webhook`. The parent is paged even if our own relayer's call to the agent never arrived. The agent re-reads the hold from the chain, and skips anything the relayer path already paged, so nobody is paged twice. | Route built and tested with signed payloads. **Not yet verified with a real Alchemy delivery.** |

## Settings

```
ALCHEMY_RPC_URL=https://monad-testnet.g.alchemy.com/v2/<key>      # secret: .env and the Render dashboard only
ALCHEMY_WEBHOOK_SIGNING_KEY=<the signing key Alchemy shows for the webhook>   # secret
```

Both are optional. Without `ALCHEMY_RPC_URL` there is no failover. Without the signing key `/alchemy/webhook` does not answer (503).
The app must have **Monad Testnet** switched on under the Alchemy app's Networks tab.

## Create the webhook (about 3 minutes)

1. Alchemy dashboard, **Webhooks**, **Create webhook**, **Custom Webhook** (GraphQL).
2. Network: **Monad Testnet**.
3. Query:

   ```graphql
   {
     block {
       logs(
         filter: {
           addresses: ["0x3aC3F87d6713390aCfeD85133Ca662d7a2ADCf87"]
           topics: [[
             "0xa6ade7bf11ac6687b3f4a170ecada2c48c184eb0aa1fc9aab5cc7aae0925134f"
             "0x4cab0cfb0e849b287d4cce61c5c4e0f33529e37adc8eedc7cb4fd6f1394daf94"
           ]]
         }
       ) {
         topics
         data
         transaction { hash }
       }
     }
   }
   ```

   The address is `ThunaiVault`. The two topics are `HoldOpened` and `SOSRaised` (`keccak256` of their signatures; `pnpm --filter @thunai/agent test` checks them).
4. Webhook URL: `https://companion-monad.vercel.app/agent/alchemy/webhook`.
5. Create it, then copy its **Signing Key** into `ALCHEMY_WEBHOOK_SIGNING_KEY` (Render environment, and `.env` locally).
6. Open a hold from the app and watch the agent log for "alchemy webhook". If the relayer path got there first, the webhook is
   correctly skipped; to see it page, stop the relayer's notification (or use Alchemy's "send test").

If the webhook's payload is shaped differently from what the agent expects, the agent finds logs anywhere in the body, so only the
signature header (`x-alchemy-signature`) and the log fields (`topics`, `data`, `transaction.hash`) matter.

## Rotating the key

The key lives in the Alchemy dashboard (the app's **API Keys**). Create a new one, put it in `.env` and Render, then delete the old one.
