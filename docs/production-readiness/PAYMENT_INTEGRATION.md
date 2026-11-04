# Payment integration status

## Decision

**Online checkout is disabled.** The current repository does not contain a verified Safepay API contract or sandbox credentials. A DNS resolution attempt for the official documentation host failed in this environment. No endpoints, credential format, or signature scheme have been guessed.

The checkout route returns an unavailable response before creating an attempt when no implemented provider is available. The Safepay adapter is not implemented, and webhook requests fail closed until it is.

## Implemented application contract

- Provider-neutral request/event types include invoice/payment IDs, amount in minor units, USD/PKR currency, return URL, webhook URL, provider transaction ID, event ID, status, and payment method.
- The client payment route obtains the invoice from the authenticated client's records, derives amount/currency server-side, generates a hashed idempotency key from the client, invoice, and request UUID, and creates the attempt through a privileged RPC.
- The database RPC locks the client-owned invoice, rejects unpayable states, prevents concurrent active attempts, and records the payment-attempt audit event.
- Checkout attachment, failure recording, and webhook reconciliation RPCs are restricted to `service_role`.
- Reconciliation deduplicates provider event IDs and checks the attempt and invoice amount/currency before changing status. Failed attempts return the invoice to `sent` for a new attempt.
- Invoice currency and amounts are stored with two decimal places. A real Safepay adapter must verify the provider's expected USD and PKR amount units before enabling this conversion.
- The internal fixture is only a normalized application contract and explicitly marks official provider verification, credentials, endpoints, and signature scheme as unavailable.

## Required before enabling checkout

1. Obtain and retain the current official Safepay API and webhook documentation.
2. Obtain authorized sandbox credentials and identify a controlled test account.
3. Implement and independently test provider authentication, checkout creation, redirects, provider idempotency, signature/timestamp verification, and event normalization exactly against that contract.
4. Apply migrations to an authorized staging database and test duplicate attempts/events, failure/retry, mismatched amount/currency, invalid signatures, paid, refund, and concurrent requests.
5. Confirm successful transactions and receipts in the provider sandbox before enabling the provider setting. Never enable with production credentials as a substitute for sandbox validation.

No Safepay transaction has been initiated or reconciled in this pass.

## Pass 3 verification

The current full Node suite passes (92 tests), including source-contract coverage that online payments remain disabled without a verified provider. These tests do not contact Safepay or validate a real signature, sandbox transaction, or database reconciliation. The local browser QA and `/api/health` checks are not payment readiness checks. Keep checkout disabled until the external requirements above and the database-backed tests pass in authorized staging.
