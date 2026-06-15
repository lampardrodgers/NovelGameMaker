create table if not exists oauth_states (
  id text primary key,
  provider text not null,
  state_hash text not null unique,
  code_verifier text,
  return_url text,
  status text not null,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  expires_at timestamptz not null,
  used_at timestamptz
);

create index if not exists oauth_states_status_expires_idx
  on oauth_states (status, expires_at);

create table if not exists oauth_identities (
  id text primary key,
  provider text not null,
  subject text not null,
  user_id text not null references user_accounts(id) on delete cascade,
  email text not null,
  name text,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  last_login_at timestamptz,
  metadata jsonb,
  unique (provider, subject)
);

create index if not exists oauth_identities_user_updated_idx
  on oauth_identities (user_id, updated_at desc);

create index if not exists oauth_identities_email_idx
  on oauth_identities (email);
