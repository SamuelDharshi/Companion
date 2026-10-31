/** Pure decision rules, kept apart from the CRE runtime so they can be tested directly. */

export type Assessment = { riskScore: number; reasonCode: number; repaged: boolean }

const MAX_REASON_CODE = 5

/**
 * Accepts the agent's answer only if every field is present and in range. Anything else returns null, and the workflow
 * then ignores the AI step entirely. The score can only change when a parent is reminded; it can never move money.
 */
export const parseAssessment = (detail: unknown): Assessment | null => {
  if (typeof detail !== "object" || detail === null) return null
  const { riskScore, reasonCode, repaged } = detail as Record<string, unknown>
  if (!Number.isInteger(riskScore) || (riskScore as number) < 0 || (riskScore as number) > 100) return null
  if (!Number.isInteger(reasonCode) || (reasonCode as number) < 0 || (reasonCode as number) > MAX_REASON_CODE) return null
  if (typeof repaged !== "boolean") return null
  return { riskScore: riskScore as number, reasonCode: reasonCode as number, repaged }
}

export const earliestAssessAge = (repageAfterSeconds: number) => Math.floor(repageAfterSeconds / 2)

/**
 * With a valid assessment the agent tracks whether a reminder went out, so a missed run cannot lose it, and high risk
 * reminds at half the usual wait. Without one, this keeps the original single 60-second window, because an agent that
 * cannot assess also cannot stop a repeated reminder.
 */
export const repageDue = (age: number, repageAfterSeconds: number, highRiskScore: number, assessment: Assessment | null): boolean => {
  if (!assessment) return age >= repageAfterSeconds && age < repageAfterSeconds + 60
  if (assessment.repaged) return false
  const wait = assessment.riskScore >= highRiskScore ? earliestAssessAge(repageAfterSeconds) : repageAfterSeconds
  return age >= wait
}
