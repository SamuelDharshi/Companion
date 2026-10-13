# Deployment: Vercel for the site, Render for the servers

```
https://companion-monad.vercel.app/            the landing page          (Vercel)
https://companion-monad.vercel.app/app         the Companion app          (Vercel, an Expo web export)
https://companion-monad.vercel.app/relayer/*   proxied to the API service (Render)
https://companion-monad.vercel.app/agent/*     proxied to the API service (Render), under /agent
```

The relayer and the agent run as **one** Render service (`scripts/serve.mjs`), because a service has one public port.
It routes `/agent/*` to the agent and everything else to the relayer, and the two still talk to each other on localhost.

Why one origin matters for this product:

- **A passkey is tied to one host.** `companion-monad.vercel.app` is that host. Never move to another, and never create
  accounts anywhere else: they would be unreachable from here.
- **No CORS and no mixed content.** The app calls `/relayer` and `/agent` on its own origin.
- **The servers' addresses and tokens never reach a browser.** Vercel forwards to Render from the server side.

## What is deployed

| Part | Where | How it is updated |
|---|---|---|
| Site, with the app at `/app` | Vercel project `companion-monad` | `node scripts/build-web.mjs` (exports the app into `frontend/public/app`), then `cd frontend && vercel deploy --prod` |
| Relayer and agent | Render web service `companion-api` (**free** plan, no disk) | Render redeploys on every push to `main` |

The Vercel project reads two server-side variables, `RELAYER_URL` and `AGENT_URL`. They point at Render and are
**baked in at build time**, so changing them needs a redeploy:

```bash
cd frontend
printf 'https://companion-api-27cv.onrender.com'        | vercel env add RELAYER_URL production --force
printf 'https://companion-api-27cv.onrender.com/agent'  | vercel env add AGENT_URL   production --force
vercel deploy --prod
```

Build on Vercel itself, not with `vercel build` on Windows (it cannot create the symlinks Next.js asks for).

## The Render service, step by step (once)

1. Create a free Render account (no card needed) and connect your GitHub.
   The blueprint uses the **free** plan. A free service sleeps after 15 minutes without inbound requests, and a sleeping
   service has no keeper, so an unanswered hold would not expire and the weekly allowance would not run. Step 6 below keeps it awake.
2. **New, Blueprint**, pick the `Companion` repository. Render reads `render.yaml` and proposes `companion-api`.
3. Fill the values marked `sync: false`. To avoid typing, run this on your machine and paste from the file it writes:

   ```bash
   node scripts/render-env.mjs --site https://companion-monad.vercel.app
   ```

   It writes `.render.env` (git-ignored) with exactly the values the service needs, copied from your `.env`. In Render's
   Environment page, **Add from .env** takes the whole file at once. It leaves out `DEPLOYER_PRIVATE_KEY`, which the
   service never needs. Delete `.render.env` afterwards.
4. The name `companion-api` was already taken on Render, so the live service is **https://companion-api-27cv.onrender.com**. The two Vercel
   variables above point at it. If you ever recreate the service, update them and redeploy the site.
5. When the first deploy is live, check `https://companion-api-27cv.onrender.com/health` and `.../agent/health`, then
   `https://companion-monad.vercel.app/relayer/health`. The first request after a sleep takes about a minute.
6. **Keep it awake.** Create a free monitor at [UptimeRobot](https://uptimerobot.com) or [cron-job.org](https://cron-job.org)
   that requests `https://companion-api-27cv.onrender.com/health` every 5 minutes. One free service has 750 hours a month, which
   covers a whole month. Before recording or presenting, open `/relayer/health` yourself to be sure it is awake.

Things that will not be obvious:

- **There is no disk on the free plan.** Display names, masked contacts, push subscriptions and invites not yet accepted live in
  a temporary folder and are lost on every restart or redeploy. The chain holds the money, the passkeys, the envelope and the
  notes, so no funds are lost, but a hold card may show "someone new" instead of a name, parents may need to turn alerts on again,
  and an invite not yet accepted must be re-sent. **Do not redeploy or restart the service mid-demo, and finish onboarding a
  family in one sitting.** A paid plan with a disk removes all of this.
- **Do not set `THUNAI_VAULT_ADDRESS` or the other contract addresses** on Render. They are read from
  `contracts/deployments/10143.json` in the repository. To switch to the Agora vault later, set `THUNAI_DEPLOYMENT=agora`
  and `THUNAI_START_BLOCK`, nothing else.
- **Secrets go only in the Render dashboard.** The relayer's and agent's keys hold gas only, but treat them as secrets.

## Run it locally

```bash
pnpm dev                 # relayer + agent (and the Expo dev server for working on the app)
pnpm web:dev             # exports the app into the site and starts it on http://localhost:3000
```

`pnpm web:build` does the export alone; `pnpm web:build -- --next` also runs `next build`, exactly as a host would.
`node scripts/serve.mjs` runs the relayer and agent behind one port, the way Render does.

## Tunnelling for a phone test (before a real deploy)

```bash
node scripts/build-web.mjs --next
cd frontend && pnpm exec next start -p 3000
ngrok http 3000            # use a reserved domain: a passkey is tied to its host
```

Set `APP_URL=https://<your-reserved-domain>/app` in `.env` and restart `pnpm dev`. Accounts made on a tunnel are not
the accounts of the deployed site.

## Status

Verified: the site is live on Vercel, `/`, `/app`, a deep link (`/app/hold/3`) and the service worker
(`/app/sw.js`) all answer. `scripts/serve.mjs` was run locally: `/health` reaches the relayer, `/agent/health` reaches the
agent. The Render service itself has not been created yet; see STATUS.md.
