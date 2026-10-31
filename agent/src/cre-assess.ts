/** What the CRE workflow may learn about a held payment: numbers only, never the memo, payee or explanation. */
export function assessment(brief: { classification: { scriptId: number; confidence: number }; repagedAt?: number }) {
  return {
    riskScore: Math.round(brief.classification.confidence * 100),
    reasonCode: brief.classification.scriptId,
    repaged: brief.repagedAt !== undefined,
  };
}
