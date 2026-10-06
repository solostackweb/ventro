# ADR-007: Defer Payment Integration Until Commercial Activation

## Status

Accepted

## Date

2026-10-06

## Context

Ventro's immediate product risk is the quality of its VC, YC, investment, thesis, pattern, and answer engines. The only access mechanism required now is the verified-student 20-day trial. Razorpay credentials, webhook configuration, pricing operations, and production payment support are not ready and would distract from the core intelligence system.

An incomplete payment path is worse than an intentionally unavailable one because it can create orders, expose misleading UI, or mutate entitlements without the full provider and operational contract.

## Decision

- Defer Razorpay checkout, webhook processing, subscription lifecycle, invoices, refunds, and payment recovery to Phase 7: Commercial Activation and Payments.
- Keep payment routes and CTAs fail-closed and explicitly unavailable until that phase is approved.
- Do not require payment-provider credentials in local development, CI, preview, or production before commercial activation.
- Build the 20-day student trial as an independent, server-authoritative access flow with no card or provider call.
- Reserve `subscribed` for the future payment system and prevent users from writing it directly.
- Preserve ADR-001's webhook-only rule as the security contract for the later implementation.

## Consequences

- Milestone 0 can be judged on trial correctness, entitlement security, health checks, and honest UI state.
- Current users cannot purchase a plan until commercial activation.
- Payment schemas and provider-specific code may be removed, disabled, or left unused, but no reachable path may create an order or grant paid access.
- Phase 7 requires its own architecture, security, reconciliation, and end-to-end readiness review before payment controls are enabled.

## Exit Conditions for the Deferral

Payment work may begin only when pricing and legal decisions are settled, provider credentials and webhook ownership are available, and the team is ready to test the complete subscription lifecycle rather than only checkout creation.
