# ADR-003: Canonical Funding-Round Identity

## Status
Accepted

## Date
2026-10-05

## Context
Funding rounds must be represented as single economic events with multiple participants, not as separate investment records per investor. This prevents:
- Duplicate rounds for the same company/date
- Conflicting amounts/currencies for the same round
- Ambiguity about which investors participated together

## Decision
- `funding_rounds` table represents ONE round (company + date + stage)
- `round_participants` table links funds to rounds with explicit roles
- `investments` table deprecated for new data; kept for backward compatibility
- Undisclosed amounts represented as `NULL` (never as 0)
- Currency + conversion rate + conversion date stored per round
- Conflicts tracked explicitly in `conflicts` JSONB field

## Schema
```sql
CREATE TABLE funding_rounds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id),
  announced_date TIMESTAMPTZ NOT NULL,
  round_stage TEXT CHECK (round_stage IN (...)),
  amount_usd BIGINT, -- NULL = undisclosed
  amount_currency TEXT DEFAULT 'USD',
  conversion_rate NUMERIC,
  conversion_date DATE,
  source_urls TEXT[] DEFAULT '{}',
  verification_status TEXT DEFAULT 'unverified',
  conflicts JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, announced_date, round_stage) -- one round per company/date/stage
);

CREATE TABLE round_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  round_id UUID NOT NULL REFERENCES funding_rounds(id) ON DELETE CASCADE,
  fund_id UUID NOT NULL REFERENCES funds(id),
  fund_vehicle_id UUID REFERENCES fund_vehicles(id),
  investor_role TEXT CHECK (investor_role IN ('lead', 'participant', 'undisclosed')),
  amount_usd BIGINT, -- NULL if undisclosed for this participant
  source_urls TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(round_id, fund_id)
);
```

## Migration Strategy
- New tables created alongside existing `investments`
- Backfill script maps existing investments → rounds + participants
- `investments` table retained for read compatibility
- API layer serves unified view from new tables

## Consequences
- Single source of truth for round identity
- Clear lead vs participant distinction
- Undisclosed amounts properly represented
- Conflict resolution explicit and auditable
- Enables accurate deal-count and dollar-weighted analytics