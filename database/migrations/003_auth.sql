CREATE TABLE IF NOT EXISTS player_accounts (
  player_id uuid PRIMARY KEY REFERENCES players(id) ON DELETE CASCADE,
  email varchar(254) NOT NULL,
  password_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS player_accounts_email_unique
  ON player_accounts (lower(email));

CREATE TABLE IF NOT EXISTS auth_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id uuid NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  token_hash char(64) NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS auth_sessions_player_id
  ON auth_sessions (player_id);
CREATE INDEX IF NOT EXISTS auth_sessions_expires_at
  ON auth_sessions (expires_at);

DROP TRIGGER IF EXISTS player_accounts_set_updated_at ON player_accounts;
CREATE TRIGGER player_accounts_set_updated_at BEFORE UPDATE ON player_accounts
FOR EACH ROW EXECUTE FUNCTION set_updated_at();
