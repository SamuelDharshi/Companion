import { Platform } from "react-native";

/**
 * The WebAuthn relying party ID.
 *
 * Passkeys are scoped to this host and cannot be used from anywhere else, which is what
 * stops a phishing page from collecting a guardian's approval. It therefore has to match
 * the origin the app is actually served from, so on web it is read from the browser
 * rather than hardcoded: a demo served from `localhost` and a judge's device opening a
 * deployed URL both need to work without a rebuild.
 */
/**
 * Where the app is mounted: "" when it owns the whole site, "/app" when the landing page serves it there.
 * Inlined at build time from EXPO_PUBLIC_BASE_PATH, so links, invites and the service worker all agree.
 */
export const BASE_PATH = (process.env.EXPO_PUBLIC_BASE_PATH ?? "").replace(/\/$/, "");

export function rpId(): string {
  const configured = process.env.EXPO_PUBLIC_RP_ID;
  if (configured) return configured;

  if (Platform.OS === "web" && typeof window !== "undefined") {
    // `localhost` is a WebAuthn secure context, so the demo works with no certificate.
    return window.location.hostname;
  }

  // Native builds are bound to the associated domain declared in app.json.
  return "thunai.app";
}

/** Where the app is served from, used to build invite links. */
export function appOrigin(): string {
  if (Platform.OS === "web" && typeof window !== "undefined") return window.location.origin + BASE_PATH;
  return "https://thunai.app";
}

/**
 * A secure page that cannot reach its own server. Browsers block an HTTPS page from calling a
 * plain-HTTP API ("mixed content"), which shows up as a vague network error. Say so instead.
 */
export function connectionProblem(relayerUrl: string, agentUrl: string): string | undefined {
  if (Platform.OS !== "web" || typeof window === "undefined") return undefined;
  if (window.location.protocol !== "https:") return undefined;
  const plain = [relayerUrl, agentUrl].find((url) => {
    try {
      const u = new URL(url);
      return u.protocol === "http:" && !["localhost", "127.0.0.1"].includes(u.hostname);
    } catch {
      return false;
    }
  });
  return plain
    ? `This page is secure but the server address (${plain}) is not, so the browser blocks it. The server needs an HTTPS address.`
    : undefined;
}

/**
 * Whether this device can do what Companion needs.
 *
 * A parent's low-end Android may not support the PRF extension, and that is a hard
 * requirement rather than a nice-to-have, so it is better to say so plainly on the first
 * screen than to fail halfway through a Face ID prompt.
 */
export function passkeySupport(): { supported: boolean; reason?: string } {
  // React Native has no WebAuthn (`navigator.credentials`), so claiming support here would
  // fail halfway through a Face ID prompt. Native needs a passkey module in a dev build.
  if (Platform.OS !== "web") {
    return {
      supported: false,
      reason:
        "Face ID sign-in is not built into the native app yet. Open Companion in your phone's browser instead.",
    };
  }
  if (typeof window === "undefined") return { supported: false, reason: "No browser available." };
  if (!window.PublicKeyCredential) {
    return {
      supported: false,
      reason: "This browser does not support passkeys. Try Safari on iPhone or Chrome on Android.",
    };
  }
  if (!window.isSecureContext) {
    return {
      supported: false,
      reason: "Passkeys need a secure connection. Open Companion over HTTPS, or on localhost.",
    };
  }
  return { supported: true };
}
