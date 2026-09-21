ALTER TABLE player_progress
  ADD COLUMN IF NOT EXISTS selected_level smallint NOT NULL DEFAULT 1 CHECK (selected_level BETWEEN 1 AND 10),
  ADD COLUMN IF NOT EXISTS easy_levels_completed smallint NOT NULL DEFAULT 0 CHECK (easy_levels_completed BETWEEN 0 AND 10),
  ADD COLUMN IF NOT EXISTS medium_levels_completed smallint NOT NULL DEFAULT 0 CHECK (medium_levels_completed BETWEEN 0 AND 10),
  ADD COLUMN IF NOT EXISTS hard_levels_completed smallint NOT NULL DEFAULT 0 CHECK (hard_levels_completed BETWEEN 0 AND 10),
  ADD COLUMN IF NOT EXISTS expert_levels_completed smallint NOT NULL DEFAULT 0 CHECK (expert_levels_completed BETWEEN 0 AND 10);

ALTER TABLE player_progress ALTER COLUMN selected_difficulty SET DEFAULT 'easy';

ALTER TABLE game_runs
  ADD COLUMN IF NOT EXISTS level smallint NOT NULL DEFAULT 1 CHECK (level BETWEEN 1 AND 10);

ALTER TYPE obstacle_kind ADD VALUE IF NOT EXISTS 'cones';
ALTER TYPE obstacle_kind ADD VALUE IF NOT EXISTS 'pit';
ALTER TYPE obstacle_kind ADD VALUE IF NOT EXISTS 'spinner';
ALTER TYPE obstacle_kind ADD VALUE IF NOT EXISTS 'crusher';
