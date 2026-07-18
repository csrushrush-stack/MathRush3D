UPDATE player_progress
SET selected_level = LEAST(selected_level, 5),
    easy_levels_completed = LEAST(easy_levels_completed, 5),
    medium_levels_completed = LEAST(medium_levels_completed, 5),
    hard_levels_completed = LEAST(hard_levels_completed, 5),
    expert_levels_completed = LEAST(expert_levels_completed, 5);

ALTER TABLE player_progress
  DROP CONSTRAINT IF EXISTS player_progress_selected_level_check,
  DROP CONSTRAINT IF EXISTS player_progress_easy_levels_completed_check,
  DROP CONSTRAINT IF EXISTS player_progress_medium_levels_completed_check,
  DROP CONSTRAINT IF EXISTS player_progress_hard_levels_completed_check,
  DROP CONSTRAINT IF EXISTS player_progress_expert_levels_completed_check;

ALTER TABLE player_progress
  ADD CONSTRAINT player_progress_selected_level_check CHECK (selected_level BETWEEN 1 AND 5),
  ADD CONSTRAINT player_progress_easy_levels_completed_check CHECK (easy_levels_completed BETWEEN 0 AND 5),
  ADD CONSTRAINT player_progress_medium_levels_completed_check CHECK (medium_levels_completed BETWEEN 0 AND 5),
  ADD CONSTRAINT player_progress_hard_levels_completed_check CHECK (hard_levels_completed BETWEEN 0 AND 5),
  ADD CONSTRAINT player_progress_expert_levels_completed_check CHECK (expert_levels_completed BETWEEN 0 AND 5);
