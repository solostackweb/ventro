# ADR-001: Paid Entitlement Activation via Verified Webhook Only

## Status
Accepted for future commercial activation; implementation deferred

## Date
2026-10-06

## Context
The current checkout flow grants `subscribed` entitlement immediately upon checkout intent creation, before any payment is verified. This is a critical security vulnerability that allows users to gain paid access without paying.

## Decision
Payment integration is deferred until the final commercial-activation milestone. In the current product phase:

- Checkout and payment-provider calls are disabled.
- The Razorpay webhook surface fails closed and cannot mutate subscriptions or entitlements.
- Payment CTAs are disabled or explicitly labelled unavailable.
- No Razorpay credential is required for the application or CI to operate.
- Student-trial activation is a separate access flow and never creates a checkout or provider order.

When commercial activation begins, paid entitlements (`subscribed`) MUST only be granted via cryptographically verified, idempotent payment-provider events. Creating a checkout order or receiving a browser success callback must never grant access.

## Consequences
- The core intelligence product and free trial can ship without payment credentials or a half-live payment path.
- `subscribed` remains a reserved entitlement and cannot be granted through public/client profile writes.
- Provider-specific data structures and UI may change when commercial requirements are finalized.
- Future payment activation requires a separate security and production-readiness gate.

## Current Implementation Contract

- `src/app/api/checkout/route.ts`: return a stable feature-unavailable response; do not call Razorpay and do not write subscription or entitlement state.
- `src/app/api/webhooks/razorpay/route.ts`: fail closed while payments are disabled; do not accept unsigned events or mutate data.
- Pricing/settings UI: show trial state accurately and keep paid purchase controls disabled.
- Database/RLS: prevent authenticated users from directly granting themselves `subscribed` or modifying billing-authority fields.

The provider-specific schema and verified webhook implementation belong to Phase 7, not Milestone 0.
