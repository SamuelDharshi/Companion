# Legal and consumer-protection design

Companion is a testnet prototype using test tokens. This document is not legal or financial advice, and the framework
mapping below is a design reference that a qualified lawyer has not reviewed.

## 1. The problem

Students abroad and their parents are targeted by impersonation, "visa or fee" and authorized-push-payment (APP) scams.
In an APP scam the victim makes the payment personally, so recovery after transfer is often difficult. The scammer's main
tool is isolation: "do not tell anyone." Companion is designed around that fact.

## 2. The legal design

| Principle | How Companion implements it | Limit |
|---|---|---|
| Consent and authority | Releasing a held payment needs a parent's passkey (WebAuthn, P-256), verified inside `ThunaiVault`. CRE and the agent can only run an allowance the parent signed, send a reminder, or refund the student. | A coerced parent can still approve. |
| Cooling-off | Payments to new or flagged payees move to escrow and a family member is paged. This resembles a cooling-off period by design; it is a product rule, not a statutory one. | It covers money in the app only. |
| Default-safe refund | An unanswered hold can only return to the student, never go to the payee. | Refund depends on someone calling `expireHold`; anyone may. |
| Shared scam signals | `ScamSignals` accepts a report only for a hold a guardian really cancelled, and it raises the hold level for other families. It resembles a fraud registry but is not an official one. | A hashed handle is pseudonymous, not anonymous. False reports need a dispute process that does not exist yet. |
| Evidence trail | Holds and releases are contract events. `CompanionAuditLog` adds CRE actions with timestamps and a hash of the agent's result. | Whether a court, bank or police force accepts these records is untested. The log proves that a report was recorded, not that its content is true. |

## 3. Frameworks to map against

- **RBI digital-fraud guidance and customer-liability principles (India):** reference for how fast reporting and bank
  liability are treated. Companion is not a regulated bank product.
- **UK PSR APP fraud reimbursement rules:** an international benchmark. Companion prevents payment; it does not reimburse.
- **Consumer Protection Act 2019 (India):** a commercial version would need fair, transparent terms and grievance handling.
- **DPDP Act 2023 (India):** data minimization, summarized below.
- **FEMA and the Liberalised Remittance Scheme:** an open question. Funding from India would need a licensed partner.

### Data handled (from the repository's documentation)

- **Agent and relayer memory:** display names, masked contacts, push subscriptions, pending invites and hold briefings.
- **Onchain:** hashed payee handles, memo hashes, encrypted notes, amounts, addresses and timestamps. Onchain data cannot
  be erased, which creates a tension with erasure rights that needs legal review.
- **Never stored by design:** passkey private keys, PRF outputs, derived keys and note plaintext.
- **Sent to the model provider when the classifier runs:** the classifier's inputs, including memo text. A production
  privacy notice must disclose this.

## 4. Open legal questions

1. Who is liable if the AI misclassifies? Today the model only explains; fixed rules open holds.
2. Does holding funds in a family vault amount to custody or money transmission?
3. How do cross-border stablecoin remittance rules apply in India and the destination country?
4. How far can an automated hold be enforced against an adult student's wishes?

## 5. What production would need

A licensed remittance partner, KYC, a grievance officer, terms of service, a privacy notice, an incident-response process,
a dispute process for network reports, and an independent security audit.
