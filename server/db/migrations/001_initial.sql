CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$ BEGIN
  CREATE TYPE difficulty_level AS ENUM ('easy', 'medium', 'hard', 'expert');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE run_status AS ENUM ('won', 'lost');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE obstacle_kind AS ENUM ('wall', 'blocker', 'enemy', 'hammer');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS skins (
  id text PRIMARY KEY,
  name text NOT NULL,
  color text NOT NULL CHECK (color ~ '^#[0-9A-Fa-f]{6}$'),
  price integer NOT NULL DEFAULT 0 CHECK (price >= 0),
  sort_order integer NOT NULL DEFAULT 0,
  is_available boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO skins (id, name, color, price, sort_order) VALUES
  ('default', 'Default', '#8b5cf6', 0, 0),
  ('ocean', 'Ocean', '#0ea5e9', 500, 1),
  ('forest', 'Forest', '#22c55e', 800, 2),
  ('flame', 'Flame', '#ef4444', 1000, 3),
  ('night', 'Night', '#312e81', 1500, 4),
  ('gold', 'Gold', '#f59e0b', 2000, 5)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  color = EXCLUDED.color,
  price = EXCLUDED.price,
  sort_order = EXCLUDED.sort_order;

CREATE TABLE IF NOT EXISTS players (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id text NOT NULL UNIQUE,
  display_name varchar(32) NOT NULL DEFAULT 'Math Runner',
  coins integer NOT NULL DEFAULT 250 CHECK (coins >= 0),
  best_score integer NOT NULL DEFAULT 0 CHECK (best_score >= 0),
  selected_skin text NOT NULL DEFAULT 'default' REFERENCES skins(id),
  games_played integer NOT NULL DEFAULT 0 CHECK (games_played >= 0),
  games_won integer NOT NULL DEFAULT 0 CHECK (games_won >= 0),
  total_score bigint NOT NULL DEFAULT 0 CHECK (total_score >= 0),
  highest_multiplier integer NOT NULL DEFAULT 1 CHECK (highest_multiplier >= 1),
  total_math_gain bigint NOT NULL DEFAULT 0 CHECK (total_math_gain >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS player_settings (
  player_id uuid PRIMARY KEY REFERENCES players(id) ON DELETE CASCADE,
  music boolean NOT NULL DEFAULT true,
  sound_effects boolean NOT NULL DEFAULT true,
  vibration boolean NOT NULL DEFAULT true,
  notifications boolean NOT NULL DEFAULT false,
  reduced_effects boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS player_skins (
  player_id uuid NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  skin_id text NOT NULL REFERENCES skins(id),
  acquired_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (player_id, skin_id)
);

CREATE TABLE IF NOT EXISTS game_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_run_id uuid NOT NULL UNIQUE,
  player_id uuid NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  difficulty difficulty_level NOT NULL,
  status run_status NOT NULL,
  started_at timestamptz NOT NULL,
  ended_at timestamptz NOT NULL DEFAULT now(),
  duration_ms integer NOT NULL CHECK (duration_ms >= 0),
  score integer NOT NULL CHECK (score >= 0),
  distance numeric(10,2) NOT NULL CHECK (distance >= 0),
  starting_crowd integer NOT NULL DEFAULT 1 CHECK (starting_crowd >= 1),
  crowd_at_boss integer NOT NULL DEFAULT 0 CHECK (crowd_at_boss >= 0),
  ending_crowd integer NOT NULL DEFAULT 0 CHECK (ending_crowd >= 0),
  boss_health integer NOT NULL DEFAULT 0 CHECK (boss_health >= 0),
  multiplier integer NOT NULL DEFAULT 1 CHECK (multiplier >= 1),
  stars integer NOT NULL DEFAULT 0 CHECK (stars BETWEEN 0 AND 3),
  coins_earned integer NOT NULL DEFAULT 0 CHECK (coins_earned >= 0),
  math_gain integer NOT NULL DEFAULT 0,
  max_math_gain integer NOT NULL DEFAULT 0 CHECK (max_math_gain >= 0),
  client_version varchar(32) NOT NULL DEFAULT 'dev',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS gate_choices (
  id bigserial PRIMARY KEY,
  run_id uuid NOT NULL REFERENCES game_runs(id) ON DELETE CASCADE,
  gate_index smallint NOT NULL CHECK (gate_index BETWEEN 0 AND 9),
  world_z numeric(8,2) NOT NULL,
  left_expression varchar(24) NOT NULL,
  right_expression varchar(24) NOT NULL,
  chosen_side varchar(5) NOT NULL CHECK (chosen_side IN ('left', 'right')),
  chosen_delta integer NOT NULL,
  optimal_delta integer NOT NULL,
  crowd_before integer NOT NULL CHECK (crowd_before >= 0),
  crowd_after integer NOT NULL CHECK (crowd_after >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (run_id, gate_index)
);

CREATE TABLE IF NOT EXISTS obstacle_events (
  id bigserial PRIMARY KEY,
  run_id uuid NOT NULL REFERENCES game_runs(id) ON DELETE CASCADE,
  obstacle_index smallint NOT NULL CHECK (obstacle_index BETWEEN 0 AND 20),
  world_z numeric(8,2) NOT NULL,
  obstacle_type obstacle_kind NOT NULL,
  outcome varchar(16) NOT NULL CHECK (outcome IN ('hit', 'dodged', 'defeated')),
  crowd_before integer NOT NULL CHECK (crowd_before >= 0),
  crowd_after integer NOT NULL CHECK (crowd_after >= 0),
  damage integer NOT NULL CHECK (damage >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (run_id, obstacle_index)
);

CREATE TABLE IF NOT EXISTS achievements (
  id text PRIMARY KEY,
  name text NOT NULL,
  description text NOT NULL,
  target_value integer NOT NULL CHECK (target_value > 0),
  coin_reward integer NOT NULL DEFAULT 0 CHECK (coin_reward >= 0)
);

CREATE TABLE IF NOT EXISTS player_achievements (
  player_id uuid NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  achievement_id text NOT NULL REFERENCES achievements(id),
  progress integer NOT NULL DEFAULT 0 CHECK (progress >= 0),
  unlocked_at timestamptz,
  PRIMARY KEY (player_id, achievement_id)
);

INSERT INTO achievements (id, name, description, target_value, coin_reward) VALUES
  ('first_win', 'First Victory', 'Defeat the boss and finish one run.', 1, 50),
  ('math_1000', 'Number Master', 'Earn 1,000 total crowd from math gates.', 1000, 150),
  ('multiplier_10', 'Perfect Rush', 'Reach the x10 multiplier.', 10, 250),
  ('veteran_50', 'Rush Veteran', 'Complete 50 runs.', 50, 300)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  target_value = EXCLUDED.target_value,
  coin_reward = EXCLUDED.coin_reward;

CREATE INDEX IF NOT EXISTS idx_game_runs_player_created ON game_runs(player_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_game_runs_leaderboard ON game_runs(status, score DESC, ended_at ASC);
CREATE INDEX IF NOT EXISTS idx_game_runs_difficulty_score ON game_runs(difficulty, status, score DESC);

CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS players_set_updated_at ON players;
CREATE TRIGGER players_set_updated_at BEFORE UPDATE ON players
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS settings_set_updated_at ON player_settings;
CREATE TRIGGER settings_set_updated_at BEFORE UPDATE ON player_settings
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE OR REPLACE VIEW leaderboard AS
SELECT
  p.id AS player_id,
  p.display_name,
  p.best_score,
  p.highest_multiplier,
  p.games_won,
  p.selected_skin,
  p.updated_at
FROM players p
WHERE p.games_played > 0;
