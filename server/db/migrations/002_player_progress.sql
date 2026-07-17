-- Split mutable progression from player identity and add the finish conversion reward.
CREATE TABLE IF NOT EXISTS player_progress (
  player_id uuid PRIMARY KEY REFERENCES players(id) ON DELETE CASCADE,
  selected_difficulty difficulty_level NOT NULL DEFAULT 'medium',
  coins integer NOT NULL DEFAULT 250 CHECK (coins >= 0),
  best_score integer NOT NULL DEFAULT 0 CHECK (best_score >= 0),
  total_stars integer NOT NULL DEFAULT 0 CHECK (total_stars >= 0),
  games_played integer NOT NULL DEFAULT 0 CHECK (games_played >= 0),
  games_won integer NOT NULL DEFAULT 0 CHECK (games_won >= 0),
  total_score bigint NOT NULL DEFAULT 0 CHECK (total_score >= 0),
  highest_multiplier integer NOT NULL DEFAULT 1 CHECK (highest_multiplier BETWEEN 1 AND 10),
  total_math_gain bigint NOT NULL DEFAULT 0 CHECK (total_math_gain >= 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO player_progress (
  player_id, coins, best_score, games_played, games_won,
  total_score, highest_multiplier, total_math_gain
)
SELECT
  id, coins, best_score, games_played, games_won,
  total_score, highest_multiplier, total_math_gain
FROM players
ON CONFLICT (player_id) DO NOTHING;

DROP VIEW IF EXISTS leaderboard;

ALTER TABLE players
  DROP COLUMN IF EXISTS coins,
  DROP COLUMN IF EXISTS best_score,
  DROP COLUMN IF EXISTS games_played,
  DROP COLUMN IF EXISTS games_won,
  DROP COLUMN IF EXISTS total_score,
  DROP COLUMN IF EXISTS highest_multiplier,
  DROP COLUMN IF EXISTS total_math_gain;

ALTER TABLE game_runs
  ADD COLUMN IF NOT EXISTS bonus_points integer NOT NULL DEFAULT 0 CHECK (bonus_points >= 0);

DROP TRIGGER IF EXISTS progress_set_updated_at ON player_progress;
CREATE TRIGGER progress_set_updated_at BEFORE UPDATE ON player_progress
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX IF NOT EXISTS idx_player_progress_best_score
  ON player_progress(best_score DESC, updated_at ASC);

CREATE OR REPLACE VIEW leaderboard AS
SELECT
  p.id AS player_id,
  p.display_name,
  progress.best_score,
  progress.highest_multiplier,
  progress.games_won,
  p.selected_skin,
  progress.updated_at
FROM players p
JOIN player_progress progress ON progress.player_id = p.id
WHERE progress.games_played > 0;

