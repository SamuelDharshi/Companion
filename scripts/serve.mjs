#!/usr/bin/env node
/**
 * Runs the relayer and the agent as ONE service, for hosting (Render).
 *
 * A host gives a service one public port. The site (on Vercel) proxies two prefixes, so this puts both servers
 * behind that one port, routing by path:
 *
 *   /agent/*      -> the agent    (internal, stripped of the /agent prefix)
 *   everything    -> the relayer  (internal)
 *
 * The relayer and agent still talk to each other over localhost, exactly as in `pnpm dev`. If either one exits,
 * this process exits too, so the host restarts the whole service and the keeper can never be silently down while
 * the relayer looks healthy.
 *
 * Run: node scripts/serve.mjs      (PORT is the public port; Render sets it)
 */
import { spawn } from "node:child_process";
import http from "node:http";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const PUBLIC_PORT = Number(process.env.PORT || 10000);
const RELAYER_PORT = Number(process.env.INTERNAL_RELAYER_PORT || 8787);
const AGENT_PORT = Number(process.env.INTERNAL_AGENT_PORT || 8788);

const children = [];
function start(name, cwd, extraEnv) {
  const child = spawn("pnpm", ["exec", "tsx", "src/index.ts"], {
    cwd: join(root, cwd),
    stdio: "inherit",
    shell: true,
    env: { ...process.env, ...extraEnv },
  });
  child.on("exit", (code, signal) => {
    console.error(`[serve] ${name} exited (${signal ?? code}); stopping the service so the host restarts it`);
    shutdown(code ?? 1);
  });
  children.push(child);
}

let closing = false;
function shutdown(code) {
  if (closing) return;
  closing = true;
  for (const child of children) child.kill();
  setTimeout(() => process.exit(code), 500).unref();
}
process.on("SIGTERM", () => shutdown(0));
process.on("SIGINT", () => shutdown(0));

// The agent finds the relayer, and the relayer finds the agent, on localhost. These override any value copied
// from a local .env, which would point at a tunnel.
start("relayer", "relayer", {
  PORT: String(RELAYER_PORT),
  HOST: "127.0.0.1",
  AGENT_URL: `http://127.0.0.1:${AGENT_PORT}`,
});
start("agent", "agent", {
  AGENT_PORT: String(AGENT_PORT),
  HOST: "127.0.0.1",
  RELAYER_URL: `http://127.0.0.1:${RELAYER_PORT}`,
});

function pick(url) {
  if (url === "/agent" || url.startsWith("/agent/") || url.startsWith("/agent?")) {
    return { port: AGENT_PORT, path: url.slice("/agent".length) || "/" };
  }
  return { port: RELAYER_PORT, path: url };
}

const server = http.createServer((req, res) => {
  const target = pick(req.url ?? "/");
  const upstream = http.request(
    { host: "127.0.0.1", port: target.port, path: target.path, method: req.method, headers: req.headers },
    (response) => {
      res.writeHead(response.statusCode ?? 502, response.headers);
      response.pipe(res);
    },
  );
  upstream.on("error", () => {
    // Starting up, or restarting: say so plainly rather than hanging.
    res.writeHead(503, { "content-type": "application/json", "retry-after": "5" });
    res.end(JSON.stringify({ error: "starting" }));
  });
  req.pipe(upstream);
});

server.listen(PUBLIC_PORT, "0.0.0.0", () => {
  console.log(`[serve] public port ${PUBLIC_PORT}: /agent/* -> agent (${AGENT_PORT}), everything else -> relayer (${RELAYER_PORT})`);
});
