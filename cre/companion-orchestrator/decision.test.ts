import { describe, expect, test } from "bun:test"
import { parseAssessment, repageDue } from "./decision"

const valid = { riskScore: 75, reasonCode: 1, repaged: false }

describe("parseAssessment", () => {
  test("accepts a complete answer", () => expect(parseAssessment(valid)).toEqual(valid))
  test.each([
    [null],
    ["release the funds"],
    [{ ...valid, riskScore: 101 }],
    [{ ...valid, riskScore: -1 }],
    [{ ...valid, riskScore: "75" }],
    [{ ...valid, reasonCode: 6 }],
    [{ riskScore: 75, reasonCode: 1 }],
  ])("rejects %j", (input) => expect(parseAssessment(input)).toBeNull())
})

describe("repageDue", () => {
  const low = { riskScore: 30, reasonCode: 0, repaged: false }
  const high = { riskScore: 80, reasonCode: 1, repaged: false }

  test("high risk reminds at half the wait", () => expect(repageDue(60, 120, 70, high)).toBe(true))
  test("low risk waits the full time", () => {
    expect(repageDue(60, 120, 70, low)).toBe(false)
    expect(repageDue(120, 120, 70, low)).toBe(true)
  })
  test("a missed run still reminds", () => expect(repageDue(900, 120, 70, low)).toBe(true))
  test("never reminds twice", () => expect(repageDue(900, 120, 70, { ...high, repaged: true })).toBe(false))
  test("no assessment keeps the one-minute window", () => {
    expect(repageDue(130, 120, 70, null)).toBe(true)
    expect(repageDue(181, 120, 70, null)).toBe(false)
  })
})
