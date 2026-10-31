# Legal and Consumer Protection

Testnet prototype only. This is an engineering team's analysis, not legal advice, and no lawyer has reviewed it. Check every reference against the current source.

## The problem

Students abroad and their families are targets of authorized push payment (APP) fraud: the real account holder is pressured into sending the money. Fake police calls and "digital arrest" scams work by isolating the victim. Because the victim approves the payment, it may not count as "unauthorized", which can weaken their recourse.

## How the design protects people

- **Family as a second key:** a flagged payment waits for a parent instead of relying on the pressured person alone.
- **Hold before money moves:** funds wait in the vault while a family member decides.
- **Reason codes:** each hold records why it was raised.
- **Refund on expiry:** an unanswered hold returns the money to the student.

## Consent and authority

Only a parent's passkey can release held funds to a payee. CRE and the agent can run an allowance the parent already signed, return an expired hold to the student, or send a reminder. Neither can pay a payee. Each agent action is rechecked against the chain before it is sent.

## Framework mapping

| Framework | Relevance | Design response | Status |
|---|---|---|---|
| RBI guidance on digital payment fraud and customer liability | Limits customer liability for unauthorized electronic transactions; APP fraud is harder to fit | Friction and a human check before the money moves | Applicability to this design is unresolved |
| Consumer-protection principles | Clear information, fair handling and redress | Reason codes, a visible hold state, automatic refund | Principle-level mapping only |
| UK PSR APP-fraud reimbursement | International reference for sharing APP fraud losses across firms | Prevention plus evidence useful in a dispute | Reference only; it does not apply to this prototype |
| India DPDP Act 2023 | Consent, purpose limits and data minimization | Should keep only what the service needs | A full data audit is still required |
| RBI Liberalised Remittance Scheme (LRS) | Rules on resident individuals' remittances abroad | None yet | **Open question** |

## Audit trail

Holds, releases, refunds and allowance runs are recorded on Monad testnet, so a family or adviser can later check what happened and when. CRE itself does not write to the chain: the agent's keeper key sends the transactions. The trail shows what happened, but it does not by itself establish who is legally liable, and its evidentiary weight would need legal review.

## Open legal questions

- Who is liable if the AI misclassifies a payment, either blocking a genuine one or missing a scam?
- Is a contract holding family funds a custody service?
- Would a production version need remittance or payment licences in India or the destination country?
- How do LRS limits, purpose declarations and reporting apply?
- How should data rights work alongside an immutable record?

## Disclaimer

Companion is a testnet prototype. It does not handle real money and offers no legal, financial or regulatory assurance.
