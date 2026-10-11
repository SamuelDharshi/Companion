import { concat, getAddress, hexToBytes, keccak256, stringToBytes, type Address, type Hex } from "viem";

/**
 * Paying a person by name and phone or email, not by address.
 *
 * A family never sees or types a `0x` address. The student types a name and a phone number or email. The relayer
 * turns that contact into a stable testnet address, and everything after that (holds, network reports, the
 * scheduled-payee merkle tree) works on that address exactly as before.
 *
 * Two properties matter:
 *
 *  - **One contact, one address, for everyone.** The contact is normalised first (an email is lower-cased, a phone
 *    is digits with its country code), then hashed with a secret salt held by the relayer. So "+91 98765 43210" and
 *    "+919876543210" are the same payee, and a report from one family raises the hold level for the next family
 *    that types the same number. That is what lets network flags work on what people actually type.
 *  - **The address says nothing about the person.** The salt is secret, so nobody can compute the address for a
 *    given phone number, or turn an address back into a phone number. Nobody holds a key for the address either:
 *    on testnet it is a labelled mailbox for the stand-in money, and a real product would pay a bank account
 *    through a licensed partner instead.
 */

export type ContactKind = "phone" | "email";
export type NormalizedContact = { kind: ContactKind; value: string };

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/**
 * Normalises what a person typed. Throws a message fit for the screen when it is neither a phone number with a
 * country code nor an email.
 */
export function normalizeContact(raw: string): NormalizedContact {
  const text = raw.trim();
  if (!text) throw new Error("Enter a phone number or an email.");

  if (text.includes("@")) {
    const value = text.toLowerCase();
    if (!EMAIL.test(value)) throw new Error("That email does not look right.");
    return { kind: "email", value };
  }

  // A phone number must carry its country code, because "9876543210" is a different person in India and in the US.
  const leadingPlus = text.startsWith("+") || text.startsWith("00");
  const digits = text.replace(/\D/g, "");
  const national = text.startsWith("00") ? digits.slice(2) : digits;
  if (!leadingPlus) throw new Error("Start the phone number with the country code, like +1 or +91.");
  if (national.length < 8 || national.length > 15) throw new Error("That phone number does not look right.");
  return { kind: "phone", value: `+${national}` };
}

/** What a family sees in place of the contact: enough to recognise, not enough to copy. */
export function maskContact(contact: NormalizedContact): string {
  if (contact.kind === "email") {
    const [name = "", domain = ""] = contact.value.split("@");
    return `${name.slice(0, 1)}•••@${domain}`;
  }
  const digits = contact.value.slice(1);
  return `+${digits.slice(0, Math.min(2, digits.length - 4))} ••••• ${digits.slice(-4)}`;
}

/** The testnet address for a contact. `salt` is the relayer's secret; the same salt always gives the same address. */
export function payeeAddress(salt: Hex, contact: NormalizedContact): Address {
  const hash = keccak256(concat([hexToBytes(salt), stringToBytes(`companion/payee/v1:${contact.kind}:${contact.value}`)]));
  return getAddress(`0x${hash.slice(-40)}`);
}
