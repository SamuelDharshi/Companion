/**
 * Where the "Open the mobile app" buttons point. By default that is `/app`, the app served by this very site.
 *
 * Set NEXT_PUBLIC_APP_URL in .env.local. For a real phone that is the HTTPS tunnel or
 * deployed URL of the Companion app, because passkeys only work over HTTPS (or localhost).
 */
export const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "/app";

/** A path on this same site opens in the same tab. A full address elsewhere opens in a new one. */
export const APP_IS_EXTERNAL = /^https?:\/\//.test(APP_URL);

/** Spread onto the buttons: same tab for our own /app, a new tab for an address elsewhere. */
export const appLinkProps = APP_IS_EXTERNAL ? { target: "_blank", rel: "noreferrer" } : {};
