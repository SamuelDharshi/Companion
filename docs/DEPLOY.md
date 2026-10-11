# One website: the landing page with the app at /app

The landing page and the Companion app are a single site, like `https://your-site/` and `https://your-site/app`.
"Open the app" opens `/app` on the same site. There is no second server to run for the app.

```
https://<site>/            the landing page
https://<site>/traction    live counts from the chain
https://<site>/app         the Companion app (an Expo web build served as static files)
https://<site>/relayer/*   proxied to the relayer
https://<site>/agent/*     proxied to the agent
```

Why one origin matters for this product:

- **A passkey is tied to one host.** With the site and the app on the same host there is exactly one host to keep forever.
- **No CORS and no mixed content.** The app calls `/relayer` and `/agent` on its own origin, so an HTTPS page never calls a
  plain-HTTP server.
- **The servers' addresses and tokens never reach a browser.** The site forwards to them from the server side.

## Run it locally

```bash
pnpm dev                 # relayer + agent (and the Expo dev server for working on the app)
pnpm web:dev             # exports the app into the site and starts it on http://localhost:3000
```

Open `http://localhost:3000` for the landing page and `http://localhost:3000/app` for the app. `pnpm web:build` does the
export alone; `pnpm web:build -- --next` also runs `next build`, exactly as a host would.

## Put it on the internet, for a demo or a phone test

Run the production build, then tunnel the **one** port:

```bash
node scripts/build-web.mjs --next
cd frontend && pnpm exec next start -p 3000
ngrok http 3000            # use a reserved domain: a passkey is tied to its host
```

Then in `.env`, set `APP_URL=https://<your-reserved-domain>/app` so alerts and invite links point at the app, and restart
`pnpm dev`. This replaces the earlier setup where the app had its own address and `pnpm tunnel` proxied it.

## Deploy on Render

`render.yaml` describes three services: the site (landing page and `/app`), the relayer and the agent.

1. Push the repository to GitHub (`.env` is git-ignored; there are no secrets in it).
2. In Render choose **New, Blueprint**, pick the repository, and let it read `render.yaml`.
3. Enter every value marked `sync: false` in the dashboard (RPC URL, the private keys, the tokens, the VAPID key, the
   Anthropic key). Generate `DEV_ADMIN_TOKEN` and `INTERNAL_TOKEN` yourself and use the **same** values on the relayer
   and the agent. See `.env.example` section 7b.
4. Set `RELAYER_URL` and `AGENT_URL` on the **site** service to the relayer's and agent's Render addresses, and set
   `APP_URL` on the relayer and agent to `https://<your-site>/app`.
5. Use the site's final address from the start. Do not create accounts on a temporary address and move later.

Things that will not be obvious:

- **The relayer needs a disk** (paid plan) to keep family names and push subscriptions between deploys. The chain itself is
  the record, so nothing of value is lost without one, but a family would have to be recreated.
- **A free service sleeps.** The first action after a sleep is slow, which is the wrong thing to show on camera. Use a paid
  plan for the relayer and agent during the demo.
- **Do not send the relayer's or agent's private keys anywhere but the dashboard.** They hold only gas, but treat them as
  secrets anyway.

**Status:** the blueprint has not been run on Render. What has been verified locally is the part that is ours: the export
mounts at `/app`, deep links such as `/app/hold/3` work, assets and the service worker are served, `/relayer` and `/agent`
are proxied, and the lock-down still holds through the proxy (`/relayer/fund` and `/agent/sos` return 401 without a token).
