import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { test } from "node:test";
import { HOLD_OPENED_TOPIC, SOS_RAISED_TOPIC, extractLogs, signatureMatches, topicToId } from "../src/alchemy";

const KEY = "unit-test-signing-key-0123456789";
const sign = (body: string) => createHmac("sha256", KEY).update(body).digest("hex");

test("a body signed with the signing key is accepted", () => {
  const body = JSON.stringify({ hello: "world" });
  assert.equal(signatureMatches(body, sign(body), KEY), true);
  assert.equal(signatureMatches(body, `0x${sign(body)}`, KEY), true);
  assert.equal(signatureMatches(body, sign(body).toUpperCase(), KEY), true);
});

test("a changed body, a wrong key, a missing header or no key is refused", () => {
  const body = JSON.stringify({ amount: 1 });
  assert.equal(signatureMatches(`${body} `, sign(body), KEY), false);
  assert.equal(signatureMatches(body, sign(body), "another-key-another-key-123456"), false);
  assert.equal(signatureMatches(body, undefined, KEY), false);
  assert.equal(signatureMatches(body, "", KEY), false);
  assert.equal(signatureMatches(body, sign(body), undefined), false);
});

test("the event topics are the keccak256 of the vault's event signatures", () => {
  assert.equal(HOLD_OPENED_TOPIC, "0xa6ade7bf11ac6687b3f4a170ecada2c48c184eb0aa1fc9aab5cc7aae0925134f");
  assert.equal(SOS_RAISED_TOPIC, "0x4cab0cfb0e849b287d4cce61c5c4e0f33529e37adc8eedc7cb4fd6f1394daf94");
});

test("logs are found wherever a webhook nests them", () => {
  const log = { topics: [HOLD_OPENED_TOPIC, "0x" + "0".repeat(63) + "5"], data: "0x", transaction: { hash: "0xabc" } };
  const graphql = { event: { data: { block: { logs: [log] } } } };
  const flat = { logs: [{ ...log, transactionHash: "0xdef" }] };
  assert.equal(extractLogs(graphql).length, 1);
  assert.equal(extractLogs(graphql)[0].txHash, "0xabc");
  assert.equal(extractLogs(flat)[0].txHash, "0xabc");
  assert.equal(extractLogs({ nothing: [1, 2, 3], nested: { deeper: [{ x: 1 }] } }).length, 0);
  assert.equal(extractLogs(null).length, 0);
});

test("an indexed id is read as a decimal string, and junk is refused", () => {
  assert.equal(topicToId("0x" + "0".repeat(63) + "5"), "5");
  assert.equal(topicToId("0x" + "0".repeat(60) + "01ff"), "511");
  assert.equal(topicToId("not hex"), undefined);
  assert.equal(topicToId(undefined), undefined);
});
