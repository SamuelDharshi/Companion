import assert from "node:assert/strict";
import { test } from "node:test";
import { assessment } from "../src/cre-assess";

test("confidence becomes a whole score and the script becomes the reason code", () => {
  assert.deepEqual(assessment({ classification: { scriptId: 1, confidence: 0.755 } }), {
    riskScore: 76,
    reasonCode: 1,
    repaged: false,
  });
});

test("a sent reminder is reported, and no private text is exposed", () => {
  const brief = { classification: { scriptId: 2, confidence: 0.5 }, repagedAt: 1, memo: "private" };
  const result = assessment(brief);
  assert.equal(result.repaged, true);
  assert.equal("memo" in result, false);
});
