create table if not exists studio_projects (
  id text primary key,
  owner_id text not null,
  title text not null,
  source text not null,
  vn_project jsonb not null,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  published_at timestamptz
);

create index if not exists studio_projects_owner_updated_idx
  on studio_projects (owner_id, updated_at desc);

alter table studio_projects
  add column if not exists current_release_id text;

alter table studio_projects
  add column if not exists published_project_url text;

alter table studio_projects
  add column if not exists published_playable_url text;

create table if not exists generation_jobs (
  id text primary key,
  kind text not null,
  status text not null,
  project_id text references studio_projects(id) on delete set null,
  owner_id text not null,
  input jsonb not null,
  output jsonb,
  error text,
  attempts integer not null default 0,
  max_attempts integer not null default 3,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  started_at timestamptz,
  finished_at timestamptz,
  next_run_at timestamptz
);

alter table generation_jobs
  add column if not exists max_attempts integer not null default 3;

alter table generation_jobs
  add column if not exists next_run_at timestamptz;

create index if not exists generation_jobs_queue_idx
  on generation_jobs (status, created_at asc);

create index if not exists generation_jobs_runnable_queue_idx
  on generation_jobs (status, next_run_at, created_at asc);

create index if not exists generation_jobs_owner_updated_idx
  on generation_jobs (owner_id, updated_at desc);

create table if not exists project_assets (
  id text primary key,
  project_id text not null references studio_projects(id) on delete cascade,
  owner_id text not null,
  asset_id text not null,
  provider text not null,
  content_type text not null,
  byte_length integer not null,
  storage_key text not null,
  public_url text,
  created_at timestamptz not null
);

create index if not exists project_assets_project_idx
  on project_assets (project_id, created_at desc);

create table if not exists published_project_releases (
  id text primary key,
  project_id text not null references studio_projects(id) on delete cascade,
  owner_id text not null,
  version integer not null,
  project_url text not null,
  playable_url text,
  project_json_asset_id text not null,
  project_json_asset_storage_key text not null,
  created_at timestamptz not null,
  metadata jsonb,
  unique (project_id, version)
);

create index if not exists published_project_releases_project_version_idx
  on published_project_releases (project_id, version desc);

create index if not exists published_project_releases_owner_created_idx
  on published_project_releases (owner_id, created_at desc);

create table if not exists release_approvals (
  id text primary key,
  project_id text not null references studio_projects(id) on delete cascade,
  owner_id text not null,
  status text not null,
  requested_by text not null,
  requested_at timestamptz not null,
  updated_at timestamptz not null,
  notes text,
  reviewed_by text,
  reviewed_at timestamptz,
  review_notes text,
  published_release_id text references published_project_releases(id) on delete set null,
  metadata jsonb
);

create unique index if not exists release_approvals_one_pending_project_idx
  on release_approvals (project_id)
  where status = 'pending';

create index if not exists release_approvals_project_updated_idx
  on release_approvals (project_id, updated_at desc);

create index if not exists release_approvals_owner_updated_idx
  on release_approvals (owner_id, updated_at desc);

create table if not exists release_approval_comments (
  id text primary key,
  approval_id text not null references release_approvals(id) on delete cascade,
  project_id text not null references studio_projects(id) on delete cascade,
  owner_id text not null,
  author text not null,
  body text not null,
  created_at timestamptz not null,
  metadata jsonb
);

create index if not exists release_approval_comments_approval_created_idx
  on release_approval_comments (approval_id, created_at asc);

create index if not exists release_approval_comments_owner_created_idx
  on release_approval_comments (owner_id, created_at desc);

create table if not exists notification_deliveries (
  id text primary key,
  owner_id text not null,
  project_id text not null references studio_projects(id) on delete cascade,
  approval_id text not null references release_approvals(id) on delete cascade,
  event text not null,
  provider text not null,
  status text not null,
  payload jsonb not null,
  attempts integer not null default 0,
  max_attempts integer not null default 3,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  next_run_at timestamptz,
  last_attempt_at timestamptz,
  delivered_at timestamptz,
  error text,
  metadata jsonb
);

create index if not exists notification_deliveries_runnable_idx
  on notification_deliveries (status, next_run_at, created_at asc);

create index if not exists notification_deliveries_owner_created_idx
  on notification_deliveries (owner_id, created_at desc);

create table if not exists deployment_invalidations (
  id text primary key,
  owner_id text not null,
  project_id text not null references studio_projects(id) on delete cascade,
  release_id text references published_project_releases(id) on delete set null,
  provider text not null,
  status text not null,
  reason text not null,
  urls jsonb not null,
  created_at timestamptz not null,
  completed_at timestamptz,
  error text,
  metadata jsonb
);

create index if not exists deployment_invalidations_project_created_idx
  on deployment_invalidations (project_id, created_at desc);

create index if not exists deployment_invalidations_owner_created_idx
  on deployment_invalidations (owner_id, created_at desc);

create table if not exists usage_events (
  id text primary key,
  owner_id text not null,
  metric text not null,
  quantity numeric not null,
  project_id text references studio_projects(id) on delete set null,
  job_id text references generation_jobs(id) on delete set null,
  metadata jsonb,
  created_at timestamptz not null
);

create index if not exists usage_events_owner_metric_created_idx
  on usage_events (owner_id, metric, created_at desc);

create table if not exists billing_plans (
  id text primary key,
  name text not null,
  description text not null,
  price_cents integer not null,
  currency text not null,
  interval text not null,
  daily_job_limit integer not null,
  daily_text_job_limit integer not null,
  daily_image_job_limit integer not null,
  active boolean not null default true,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  metadata jsonb
);

create index if not exists billing_plans_active_price_idx
  on billing_plans (active, price_cents asc);

create table if not exists billing_subscriptions (
  id text primary key,
  owner_id text not null unique,
  plan_id text not null references billing_plans(id),
  status text not null,
  current_period_start timestamptz not null,
  current_period_end timestamptz not null,
  cancel_at_period_end boolean not null default false,
  external_customer_id text,
  external_subscription_id text,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  cancelled_at timestamptz,
  metadata jsonb
);

create index if not exists billing_subscriptions_owner_updated_idx
  on billing_subscriptions (owner_id, updated_at desc);

create index if not exists billing_subscriptions_status_period_idx
  on billing_subscriptions (status, current_period_end);

create unique index if not exists billing_subscriptions_external_subscription_idx
  on billing_subscriptions (external_subscription_id)
  where external_subscription_id is not null;

create table if not exists billing_checkout_sessions (
  id text primary key,
  owner_id text not null,
  plan_id text not null references billing_plans(id),
  status text not null,
  checkout_url text not null,
  success_url text,
  cancel_url text,
  external_session_id text,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  completed_at timestamptz,
  expires_at timestamptz,
  metadata jsonb
);

create index if not exists billing_checkout_sessions_owner_created_idx
  on billing_checkout_sessions (owner_id, created_at desc);

create index if not exists billing_checkout_sessions_status_expires_idx
  on billing_checkout_sessions (status, expires_at);

create unique index if not exists billing_checkout_sessions_external_session_idx
  on billing_checkout_sessions (external_session_id)
  where external_session_id is not null;

create table if not exists billing_events (
  id text primary key,
  owner_id text not null,
  provider text not null,
  event_type text not null,
  external_event_id text,
  subscription_id text references billing_subscriptions(id) on delete set null,
  checkout_session_id text references billing_checkout_sessions(id) on delete set null,
  external_customer_id text,
  external_subscription_id text,
  external_invoice_id text,
  amount_due_cents integer,
  amount_paid_cents integer,
  currency text,
  status text,
  hosted_invoice_url text,
  invoice_pdf_url text,
  occurred_at timestamptz not null,
  created_at timestamptz not null,
  metadata jsonb
);

create index if not exists billing_events_owner_occurred_idx
  on billing_events (owner_id, occurred_at desc);

create index if not exists billing_events_subscription_occurred_idx
  on billing_events (subscription_id, occurred_at desc);

create unique index if not exists billing_events_provider_external_event_idx
  on billing_events (provider, external_event_id)
  where external_event_id is not null;

create table if not exists audit_events (
  id text primary key,
  owner_id text,
  action text not null,
  target_type text not null,
  target_id text,
  outcome text not null,
  details jsonb,
  created_at timestamptz not null
);

create index if not exists audit_events_owner_created_idx
  on audit_events (owner_id, created_at desc);

create table if not exists content_safety_reviews (
  id text primary key,
  owner_id text not null,
  source text not null,
  decision text not null,
  target_type text not null,
  target_id text,
  input_hash text not null,
  input_length integer not null,
  matched_rules jsonb not null,
  metadata jsonb,
  created_at timestamptz not null
);

create index if not exists content_safety_reviews_owner_created_idx
  on content_safety_reviews (owner_id, created_at desc);

create index if not exists content_safety_reviews_decision_idx
  on content_safety_reviews (decision, created_at desc);

create table if not exists access_tokens (
  id text primary key,
  token_hash text not null unique,
  token_prefix text not null,
  role text not null,
  owner_id text,
  label text not null,
  created_at timestamptz not null,
  last_used_at timestamptz,
  revoked_at timestamptz,
  expires_at timestamptz
);

create index if not exists access_tokens_owner_created_idx
  on access_tokens (owner_id, created_at desc);

create index if not exists access_tokens_hash_idx
  on access_tokens (token_hash);

alter table access_tokens
  add column if not exists user_id text;

create index if not exists access_tokens_user_created_idx
  on access_tokens (user_id, created_at desc);

create table if not exists user_accounts (
  id text primary key,
  email text not null unique,
  password_hash text not null,
  name text,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  email_verified_at timestamptz,
  last_login_at timestamptz,
  last_failed_login_at timestamptz,
  failed_login_count integer not null default 0,
  locked_until timestamptz,
  password_updated_at timestamptz,
	  mfa_totp_secret_encrypted text,
	  mfa_totp_enabled_at timestamptz,
	  mfa_totp_last_used_counter bigint,
	  mfa_recovery_code_hashes jsonb,
	  mfa_recovery_codes_updated_at timestamptz,
	  mfa_trusted_devices jsonb,
	  disabled_at timestamptz
	);

alter table user_accounts
  add column if not exists email_verified_at timestamptz;

alter table user_accounts
  add column if not exists password_updated_at timestamptz;

alter table user_accounts
  add column if not exists last_failed_login_at timestamptz;

alter table user_accounts
  add column if not exists failed_login_count integer not null default 0;

alter table user_accounts
  add column if not exists locked_until timestamptz;

alter table user_accounts
  add column if not exists mfa_totp_secret_encrypted text;

alter table user_accounts
  add column if not exists mfa_totp_enabled_at timestamptz;

alter table user_accounts
  add column if not exists mfa_totp_last_used_counter bigint;

alter table user_accounts
  add column if not exists mfa_recovery_code_hashes jsonb;

alter table user_accounts
  add column if not exists mfa_recovery_codes_updated_at timestamptz;

alter table user_accounts
  add column if not exists mfa_trusted_devices jsonb;

create index if not exists user_accounts_email_idx
  on user_accounts (email);

create index if not exists user_accounts_mfa_enabled_idx
  on user_accounts (mfa_totp_enabled_at)
  where mfa_totp_enabled_at is not null;

create index if not exists user_accounts_mfa_recovery_codes_updated_idx
  on user_accounts (mfa_recovery_codes_updated_at)
  where mfa_recovery_codes_updated_at is not null;

create table if not exists user_account_action_tokens (
  id text primary key,
  user_id text not null references user_accounts(id) on delete cascade,
  email text not null,
  purpose text not null,
  token_hash text not null unique,
  token_prefix text not null,
  status text not null,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  expires_at timestamptz,
  used_at timestamptz,
  revoked_at timestamptz
);

create index if not exists user_account_action_tokens_hash_idx
  on user_account_action_tokens (token_hash);

create index if not exists user_account_action_tokens_user_updated_idx
  on user_account_action_tokens (user_id, updated_at desc);

create index if not exists user_account_action_tokens_purpose_status_idx
  on user_account_action_tokens (purpose, status, expires_at);

create table if not exists user_sessions (
  id text primary key,
  user_id text not null references user_accounts(id) on delete cascade,
  token_hash text not null unique,
  token_prefix text not null,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  last_used_at timestamptz,
  revoked_at timestamptz,
  expires_at timestamptz
);

create index if not exists user_sessions_hash_idx
  on user_sessions (token_hash);

create index if not exists user_sessions_user_updated_idx
  on user_sessions (user_id, updated_at desc);

create table if not exists teams (
  id text primary key,
  name text not null,
  created_at timestamptz not null,
  updated_at timestamptz not null
);

create table if not exists team_members (
  id text primary key,
  team_id text not null references teams(id) on delete cascade,
  user_id text not null,
  role text not null,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  revoked_at timestamptz,
  unique (team_id, user_id)
);

create index if not exists team_members_team_idx
  on team_members (team_id, updated_at desc);

create index if not exists team_members_user_idx
  on team_members (user_id, updated_at desc);

create table if not exists team_invitations (
  id text primary key,
  team_id text not null references teams(id) on delete cascade,
  email text not null,
  role text not null,
  token_hash text not null unique,
  token_prefix text not null,
  status text not null,
  invited_by text not null,
  invited_user_id text,
  accepted_by_user_id text,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  expires_at timestamptz,
  accepted_at timestamptz,
  revoked_at timestamptz
);

create index if not exists team_invitations_team_updated_idx
  on team_invitations (team_id, updated_at desc);

create index if not exists team_invitations_token_hash_idx
  on team_invitations (token_hash);

create index if not exists team_invitations_status_idx
  on team_invitations (status, expires_at);
