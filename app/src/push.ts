import { Platform } from "react-native";
import { subscribeDigest, type Role } from "@thunai/shared";
import { api } from "@/api/client";
import { BASE_PATH } from "@/config";
import { signDigestWithSession } from "@/mera/account";

/**
 * Real web push for the parent's alert.
 *
 * The browser registers a service worker (`public/sw.js`), subscribes with the server's public
 * VAPID key, and hands the subscription to the relayer, signed by the person's own account key.
 * From then on the agent can reach this phone even when the app is closed. The WhatsApp link stays
 * as the backup channel, because a push can be switched off, blocked or never delivered.
 */

export type PushState =
  | "unsupported" // this browser cannot do web push at all
  | "needs-install" // iPhone: only an app added to the Home Screen can receive web push
  | "blocked" // the person said no in the browser
  | "off" // available, not turned on yet
  | "on";

const isWeb = () => Platform.OS === "web" && typeof window !== "undefined";

function isIos(): boolean {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

function isStandalone(): boolean {
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    (navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

export async function pushState(): Promise<PushState> {
  if (!isWeb() || !("serviceWorker" in navigator) || !("Notification" in window)) return "unsupported";
  if (isIos() && !isStandalone()) return "needs-install";
  if (!("PushManager" in window)) return "unsupported";
  if (Notification.permission === "denied") return "blocked";
  if (Notification.permission !== "granted") return "off";
  const registration = await navigator.serviceWorker.getRegistration(`${BASE_PATH}/sw.js`);
  const subscription = await registration?.pushManager.getSubscription();
  return subscription ? "on" : "off";
}

/** The VAPID public key is URL-safe base64; the browser wants raw bytes. */
function keyBytes(base64Url: string): Uint8Array {
  const padded = base64Url.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(base64Url.length / 4) * 4, "=");
  const raw = atob(padded);
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

export async function enablePush(familyId: string, role: Role): Promise<void> {
  if (!isWeb()) throw new Error("Alerts are only available in the browser version for now.");
  const config = await api.config();
  if (!config.vapidPublicKey) throw new Error("Alerts are not set up on the server yet.");

  const permission = await Notification.requestPermission();
  if (permission !== "granted") throw new Error("Alerts are blocked. Turn them on in your browser's site settings.");

  const registration = await navigator.serviceWorker.register(`${BASE_PATH}/sw.js`, { scope: `${BASE_PATH || ""}/` });
  await navigator.serviceWorker.ready;
  const subscription =
    (await registration.pushManager.getSubscription()) ??
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: keyBytes(config.vapidPublicKey) as BufferSource,
    }));

  const json = subscription.toJSON();
  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
    throw new Error("This browser gave back an incomplete subscription.");
  }

  // Signed by this person's own account key, so nobody else can subscribe to this family's alerts.
  const signature = await signDigestWithSession(subscribeDigest(BigInt(familyId), role, json.endpoint));
  await api.subscribe({
    familyId,
    role,
    endpoint: json.endpoint,
    keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
    signature,
  });
}
