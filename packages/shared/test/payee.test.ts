import assert from "node:assert/strict";
import { test } from "node:test";
import { handleHash, maskContact, normalizeContact, payeeAddress } from "../src/index";

const SALT = `0x${"11".repeat(32)}` as const;
const OTHER_SALT = `0x${"22".repeat(32)}` as const;

test("a phone number is the same payee however it is typed", () => {
  const typed = ["+91 98765 43210", "+919876543210", "+91-98765-43210", "  +91 (98765) 43210 ", "0091 98765 43210"];
  const addresses = new Set(typed.map((raw) => payeeAddress(SALT, normalizeContact(raw))));
  assert.equal(addresses.size, 1);
  assert.deepEqual(normalizeContact("+91 98765 43210"), { kind: "phone", value: "+919876543210" });
});

test("an email is the same payee in any case and with stray spaces", () => {
  const a = payeeAddress(SALT, normalizeContact("Ravi.Kumar@Gmail.com"));
  const b = payeeAddress(SALT, normalizeContact("  ravi.kumar@gmail.com "));
  assert.equal(a, b);
});

test("different people get different addresses, and a phone is not an email", () => {
  const one = payeeAddress(SALT, normalizeContact("+14155550101"));
  const two = payeeAddress(SALT, normalizeContact("+14155550102"));
  const mail = payeeAddress(SALT, normalizeContact("a@b.co"));
  assert.equal(new Set([one, two, mail]).size, 3);
});

test("the address cannot be worked out without the relayer's salt", () => {
  const contact = normalizeContact("+919876543210");
  assert.notEqual(payeeAddress(SALT, contact), payeeAddress(OTHER_SALT, contact));
});

test("a phone number without a country code is refused, because it would mean two different people", () => {
  assert.throws(() => normalizeContact("9876543210"), /country code/);
  assert.throws(() => normalizeContact("+123"), /does not look right/);
  assert.throws(() => normalizeContact(""), /Enter a phone/);
  assert.throws(() => normalizeContact("not-an-email@"), /email/);
});

test("the network report key is the hash of the derived address, so a report follows the typed contact", () => {
  const a = payeeAddress(SALT, normalizeContact("+91 98765 43210"));
  const b = payeeAddress(SALT, normalizeContact("+919876543210"));
  assert.equal(handleHash(a), handleHash(b));
});

test("what a family sees hides most of the contact and never shows an address", () => {
  assert.equal(maskContact(normalizeContact("+91 98765 43210")), "+91 ••••• 3210");
  assert.equal(maskContact(normalizeContact("ravi.kumar@gmail.com")), "r•••@gmail.com");
  assert.ok(!/0x/i.test(maskContact(normalizeContact("+14155550101"))));
});
