import { bytesToHex, hexToBytes, type Hex } from "viem";

/**
 * Private family notes, encrypted so that only the person who wrote them can read them back.
 *
 * The key is never stored. It is the passkey's PRF output for the fixed salt
 * `keccak256("thunai/notes")`, so any device that holds the same passkey (a phone restored
 * from iCloud Keychain or Google Password Manager, say) derives the same key after one Face ID.
 * The ciphertext is stored in the vault contract, readable by anyone, useful to no one else.
 *
 * Format: one version byte, a 12-byte random IV, then AES-256-GCM ciphertext with its tag.
 * The version byte is authenticated, so it cannot be flipped to downgrade the format.
 *
 * This file is shared by the app and by the end-to-end test, so the code that is tested is the
 * code that ships.
 */

export type FamilyNotes = {
  familyQuestion?: string;
  familyAnswerHint?: string;
  /** Short notes the family kept from previous holds, by hold id. */
  holdNotes?: Record<string, string>;
};

export const NOTES_FORMAT_VERSION = 1;
const IV_BYTES = 12;

// WebCrypto is in every browser and in Node 20+. The type is left loose on purpose so this file
// compiles for the app (DOM lib) and for the Node services (no DOM lib) alike.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function subtle(): any {
  const api = (globalThis as any).crypto?.subtle;
  if (!api) throw new Error("This device cannot do the encryption Companion needs (no WebCrypto).");
  return api;
}

async function importKey(key: Uint8Array, usage: "encrypt" | "decrypt") {
  if (key.length !== 32) throw new Error("A notes key must be exactly 32 bytes.");
  return subtle().importKey("raw", key, { name: "AES-GCM" }, false, [usage]);
}

export async function encryptNotes(key: Uint8Array, notes: FamilyNotes): Promise<Hex> {
  const iv: Uint8Array = (globalThis as any).crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const version = new Uint8Array([NOTES_FORMAT_VERSION]);
  const plaintext = new TextEncoder().encode(JSON.stringify(notes));
  const sealed = new Uint8Array(
    await subtle().encrypt(
      { name: "AES-GCM", iv, additionalData: version },
      await importKey(key, "encrypt"),
      plaintext,
    ),
  );
  const blob = new Uint8Array(1 + IV_BYTES + sealed.length);
  blob.set(version, 0);
  blob.set(iv, 1);
  blob.set(sealed, 1 + IV_BYTES);
  return bytesToHex(blob);
}

/** Throws if the key is wrong or the blob was altered: AES-GCM authenticates both. */
export async function decryptNotes(key: Uint8Array, blob: Hex): Promise<FamilyNotes> {
  const bytes = hexToBytes(blob);
  if (bytes.length < 1 + IV_BYTES + 16) throw new Error("These notes are too short to be valid.");
  if (bytes[0] !== NOTES_FORMAT_VERSION) throw new Error("These notes use a format this app does not know.");
  const iv = bytes.slice(1, 1 + IV_BYTES);
  const sealed = bytes.slice(1 + IV_BYTES);
  try {
    const plaintext = await subtle().decrypt(
      { name: "AES-GCM", iv, additionalData: bytes.slice(0, 1) },
      await importKey(key, "decrypt"),
      sealed,
    );
    return JSON.parse(new TextDecoder().decode(plaintext)) as FamilyNotes;
  } catch {
    throw new Error("These notes could not be opened with this passkey.");
  }
}
