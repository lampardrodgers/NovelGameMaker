alter table billing_events
  add column if not exists external_charge_id text;

alter table billing_events
  add column if not exists amount_refunded_cents integer;

alter table billing_events
  add column if not exists amount_disputed_cents integer;

create index if not exists billing_subscriptions_external_customer_idx
  on billing_subscriptions (external_customer_id)
  where external_customer_id is not null;

create index if not exists billing_events_external_charge_idx
  on billing_events (provider, external_charge_id)
  where external_charge_id is not null;
