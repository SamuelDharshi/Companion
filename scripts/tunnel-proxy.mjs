#!/usr/bin/env node
/**
 * One local port that fronts the whole stack, so a single HTTPS tunnel can serve a phone.
 *
 * A free ngrok account gets one domain. Three tunnels on one domain would be load-balanced
 * against each other, so instead this proxy routes by path:
 *
 *   /relayer/*  -> the relayer  (8787)
 *   /agent/*    -> the agent    (8788)
 *   everything  -> the Expo app (8081), including the HMR websocket
 *
 * The app is then same-origin with both APIs, so there is no CORS to configure.
 *
 * Run: node scripts/tunnel-proxy.mjs   (then: ngrok http 9000)
 */
import http from "node:http";
import net from "node:net";

const LISTEN = Number(process.env.TUNNEL_PORT || 9000);
const routes = [
  ["/relayer", Number(process.env.PORT || 8787)],
  ["/agent", Number(process.env.AGENT_PORT || 8788)],
];
const APP_PORT = 8081;

function pick(url) {
  for (const [prefix, port] of routes) {
    if (url === prefix || url.startsWith(prefix + "/") || url.startsWith(prefix + "?")) {
      return { port, path: url.slice(prefix.length) || "/" };
    }
  }
  return { port: APP_PORT, path: url };
}

const server = http.createServer((req, res) => {
  const target = pick(req.url);
  const upstream = http.request(
    { host: "127.0.0.1", port: target.port, path: target.path, method: req.method, headers: req.headers },
    (response) => {
      res.writeHead(response.statusCode ?? 502, response.headers);
      response.pipe(res);
    },
  );
  upstream.on("error", (error) => {
    res.writeHead(502, { "content-type": "text/plain" });
    res.end(`Thunai proxy: nothing listening on ${target.port} (${error.message})`);
  });
  req.pipe(upstream);
});

// Metro's hot-reload websocket.
server.on("upgrade", (req, socket, head) => {
  const target = pick(req.url);
  const upstream = net.connect(target.port, "127.0.0.1", () => {
    const headers = Object.entries(req.headers).map(([key, value]) => `${key}: ${value}`);
    upstream.write(`${req.method} ${target.path} HTTP/1.1\r\n${headers.join("\r\n")}\r\n\r\n`);
    upstream.write(head);
    socket.pipe(upstream);
    upstream.pipe(socket);
  });
  upstream.on("error", () => socket.destroy());
  socket.on("error", () => upstream.destroy());
});

server.listen(LISTEN, "127.0.0.1", () => {
  console.log(`Thunai tunnel proxy on http://127.0.0.1:${LISTEN}`);
  console.log(`  /relayer -> ${routes[0][1]}   /agent -> ${routes[1][1]}   * -> ${APP_PORT}`);
});
