import type { NextConfig } from "next";

/**
 * One site, one origin.
 *
 *   /            the landing page
 *   /traction    the live counts
 *   /app         the Companion app (an Expo web export placed in public/app by `pnpm web:build`)
 *   /relayer/*   the relayer, proxied
 *   /agent/*     the agent, proxied
 *
 * Because the app and its servers share one origin there is no CORS and no mixed content, and a passkey is
 * tied to a single permanent host. The two servers are reached through RELAYER_URL and AGENT_URL, which
 * stay on the server and never reach a browser.
 */
const RELAYER = (process.env.RELAYER_URL || "http://localhost:8787").replace(/\/$/, "");
const AGENT = (process.env.AGENT_URL || "http://localhost:8788").replace(/\/$/, "");

const nextConfig: NextConfig = {
  async rewrites() {
    return {
      beforeFiles: [
        // /app itself has no trailing file name, so point it at the exported page.
        { source: "/app", destination: "/app/index.html" },
        { source: "/relayer/:path*", destination: `${RELAYER}/:path*` },
        { source: "/agent/:path*", destination: `${AGENT}/:path*` },
      ],
      afterFiles: [],
      // Only reached when no real file matched, so scripts, fonts and images under /app are served as files,
      // while a deep link such as /app/hold/3 (a screen inside the app) gets the app's single page.
      fallback: [{ source: "/app/:path*", destination: "/app/index.html" }],
    };
  },
};

export default nextConfig;
