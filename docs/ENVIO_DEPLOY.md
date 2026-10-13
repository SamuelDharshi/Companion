# Deploying the indexer on Envio's hosted service

**Live:** `https://indexer.dev.hyperindex.xyz/228e4fb/v1/graphql`, indexing the Agora vault (Envio Cloud, development plan, branch `envio`). Envio Cloud builds from the `envio` branch, not `main`:
every push to it re-indexes from the start block, and the free plan allows only 3 deployments per indexer. Move `envio` to a new
commit only when the indexer itself changes.

Envio's local tooling does not run natively on Windows, so the indexer is deployed from the hosted
service instead. Everything it needs is already in the repo, and `pnpm check:indexer` confirms the
config, schema and handlers agree with the compiled contracts.

## What is already done

- `indexer/config.yaml` points at Monad testnet (`10143`), the deployed `ThunaiVault`
  (`0x3aC3F87d6713390aCfeD85133Ca662d7a2ADCf87`) and `ScamSignals`
  (`0xC0F7e94758975A33Bd7c1849be325734f20DA16e`), with `start_block: 70125515`, the block the vault
  was created in. Addresses are written out, not read from environment variables, so the hosted
  build needs no settings.
- It indexes every vault event, including the new `SOSRaised` and `NotesStored`.
- The schema keeps its derived entities (`Family` with `holds`, `payouts`, `checks`, `withdrawals` and
  `sos`) so one query returns a family's whole history.

## Steps you do by hand

1. The repository is already on GitHub (`SamuelDharshi/Companion`, branch `main`). The `.env` is git-ignored; nothing secret is in the repo.
2. Go to **envio.dev**, sign in with GitHub, and choose **Add Indexer**.
3. Pick the repository and set the **root directory** to `indexer`.
4. Branch: the one you pushed. Config file: `config.yaml`. Leave the environment variables empty.
5. Deploy. Wait for it to sync from block `70125515` to the head; the dashboard shows progress.
6. Open the deployment's **GraphQL endpoint** (the dashboard shows it).
   Test it in the playground with:
   ```graphql
   query { NetworkStats(where: { id: { _eq: "global" } }) { families holdsOpened scamsStopped sosRaised } }
   ```
7. Send that endpoint. Wiring it takes three settings and a redeploy of the site:
   - `.env`: `EXPO_PUBLIC_INDEXER_URL=<endpoint>` (it is public by nature; the app bundle reads it at build time),
   - then `node scripts/build-web.mjs` and `cd frontend && vercel deploy --prod`.

## What changes once it is live

- The **"Families protected"** screen reads the indexer first. The Saves, Allowances and Checks cards appear
  (they need event history), and the source line reads "Envio indexer".
- The **evidence on a hold card** ("N verified families reported this payee") reads the indexer's `Signal`
  entity.
- Under **Details**, "public counters" and "hold evidence" name the active source.
- If the indexer is slow or down, both fall back to the relayer, which reads the contract directly. The
  screen says so, and shows only what the contract can state by itself.

## After a redeploy of the contracts

Update the three lines marked `# deployment` in `indexer/config.yaml` (vault, ScamSignals, start block), push,
and redeploy on Envio. The start block comes from `contracts/broadcast/Deploy.s.sol/10143/run-latest.json`.

## Envio 3 notes (what broke the first build)

The first hosted build failed at codegen because the config used Envio 2's `networks` key; Envio 3 calls it `chains`, imports
handlers from `envio` with `indexer.onEvent(...)`, and leaves transaction hashes empty unless `field_selection` asks for them.
`pnpm check:indexer` now validates the config against the schema shipped inside the pinned `envio` package, so this is caught
before a deploy.
