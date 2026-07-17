import { Router } from 'express'
import { pool } from '../db/pool'
import { difficultySchema } from '../validation'

export const leaderboardRouter = Router()

leaderboardRouter.get('/', async (request, response) => {
  const parsedDifficulty = request.query.difficulty
    ? difficultySchema.safeParse(request.query.difficulty)
    : null
  if (parsedDifficulty && !parsedDifficulty.success) {
    response.status(400).json({ error: 'Invalid difficulty' })
    return
  }
  const difficulty = parsedDifficulty?.data ?? null
  const result = difficulty
    ? await pool.query(`
        SELECT p.id AS player_id, p.display_name, MAX(r.score)::int AS best_score,
               progress.highest_multiplier, progress.games_won, p.selected_skin
        FROM game_runs r
        JOIN players p ON p.id = r.player_id
        JOIN player_progress progress ON progress.player_id = p.id
        WHERE r.status = 'won' AND r.difficulty = $1
        GROUP BY p.id, progress.player_id
        ORDER BY best_score DESC, progress.updated_at ASC
        LIMIT 10
      `, [difficulty])
    : await pool.query(`
        SELECT player_id, display_name, best_score, highest_multiplier, games_won, selected_skin
        FROM leaderboard
        ORDER BY best_score DESC, updated_at ASC
        LIMIT 10
      `)
  response.json({
    entries: result.rows.map((row, index) => ({
      rank: index + 1,
      playerId: row.player_id,
      displayName: row.display_name,
      score: row.best_score,
      highestMultiplier: row.highest_multiplier,
      gamesWon: row.games_won,
      selectedSkin: row.selected_skin,
    })),
  })
})
