import { Router } from 'express'
import { pool } from '../db/pool'
import { calculateRunRewards } from '../../shared/gameRules'
import { runSchema } from '../validation'
import { requireAuth } from '../auth'

export const runsRouter = Router()

runsRouter.use(requireAuth)

runsRouter.post('/', async (request, response) => {
  const input = runSchema.parse(request.body)
  if (request.authPlayerId !== input.playerId) {
    response.status(403).json({ error: 'You cannot submit a run for another player' })
    return
  }
  const rewards = calculateRunRewards({
    actualMathGain: input.mathGain,
    distance: input.distance,
    multiplier: input.multiplier,
    stars: input.stars,
    won: input.status === 'won',
    bonusPoints: input.bonusPoints,
  })
  const durationMs = Math.max(
    0,
    Math.min(3_600_000, new Date(input.endedAt).getTime() - new Date(input.startedAt).getTime()),
  )
  const client = await pool.connect()

  try {
    await client.query('BEGIN')
    const duplicate = await client.query(`
      SELECT id, score, coins_earned FROM game_runs WHERE client_run_id = $1
    `, [input.clientRunId])
    if (duplicate.rowCount) {
      await client.query('ROLLBACK')
      response.json({ run: duplicate.rows[0], duplicate: true })
      return
    }

    const inserted = await client.query(`
      INSERT INTO game_runs (
        client_run_id, player_id, difficulty, status, started_at, ended_at,
        duration_ms, score, distance, starting_crowd, crowd_at_boss,
        ending_crowd, boss_health, multiplier, stars, coins_earned,
        bonus_points, math_gain, max_math_gain, client_version
      ) VALUES (
        $1, $2, $3, $4, $5, $6,
        $7, $8, $9, $10, $11,
        $12, $13, $14, $15, $16,
        $17, $18, $19, $20
      ) RETURNING id, score, coins_earned
    `, [
      input.clientRunId,
      input.playerId,
      input.difficulty,
      input.status,
      input.startedAt,
      input.endedAt,
      durationMs,
      rewards.score,
      input.distance,
      input.startingCrowd,
      input.crowdAtBoss,
      input.endingCrowd,
      input.bossHealth,
      input.multiplier,
      input.stars,
      rewards.coins,
      input.bonusPoints,
      input.mathGain,
      input.maxMathGain,
      input.clientVersion,
    ])
    const runId = inserted.rows[0].id as string

    for (const event of input.gateEvents) {
      await client.query(`
        INSERT INTO gate_choices (
          run_id, gate_index, world_z, left_expression, right_expression,
          chosen_side, chosen_delta, optimal_delta, crowd_before, crowd_after
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
      `, [
        runId,
        event.gateIndex,
        event.worldZ,
        event.leftExpression,
        event.rightExpression,
        event.chosenSide,
        event.chosenDelta,
        event.optimalDelta,
        event.crowdBefore,
        event.crowdAfter,
      ])
    }

    for (const event of input.obstacleEvents) {
      await client.query(`
        INSERT INTO obstacle_events (
          run_id, obstacle_index, world_z, obstacle_type, outcome,
          crowd_before, crowd_after, damage
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
      `, [
        runId,
        event.obstacleIndex,
        event.worldZ,
        event.obstacleType,
        event.outcome,
        event.crowdBefore,
        event.crowdAfter,
        event.damage,
      ])
    }

    const player = await client.query(`
      UPDATE player_progress SET
        coins = coins + $2,
        best_score = GREATEST(best_score, $3),
        total_stars = total_stars + $7,
        games_played = games_played + 1,
        games_won = games_won + $4,
        total_score = total_score + $3,
        highest_multiplier = GREATEST(highest_multiplier, $5),
        total_math_gain = total_math_gain + $6
      WHERE player_id = $1
      RETURNING coins, best_score, games_played, games_won, total_stars, total_score,
                highest_multiplier, total_math_gain
    `, [
      input.playerId,
      rewards.coins,
      rewards.score,
      input.status === 'won' ? 1 : 0,
      input.multiplier,
      Math.max(0, input.mathGain),
      input.stars,
    ])
    if (!player.rowCount) throw new Error('Player not found')
    await client.query('UPDATE players SET last_seen_at = now() WHERE id = $1', [input.playerId])

    await client.query(`
      INSERT INTO player_achievements (player_id, achievement_id, progress, unlocked_at)
      SELECT
        p.id,
        a.id,
        CASE a.id
          WHEN 'first_win' THEN progress.games_won
          WHEN 'math_1000' THEN LEAST(progress.total_math_gain, 2147483647)::int
          WHEN 'multiplier_10' THEN progress.highest_multiplier
          WHEN 'veteran_50' THEN progress.games_played
          ELSE 0
        END,
        CASE WHEN
          CASE a.id
            WHEN 'first_win' THEN progress.games_won
            WHEN 'math_1000' THEN LEAST(progress.total_math_gain, 2147483647)::int
            WHEN 'multiplier_10' THEN progress.highest_multiplier
            WHEN 'veteran_50' THEN progress.games_played
            ELSE 0
          END >= a.target_value
        THEN now() ELSE NULL END
      FROM players p
      JOIN player_progress progress ON progress.player_id = p.id
      CROSS JOIN achievements a
      WHERE p.id = $1
      ON CONFLICT (player_id, achievement_id) DO UPDATE SET
        progress = EXCLUDED.progress,
        unlocked_at = COALESCE(player_achievements.unlocked_at, EXCLUDED.unlocked_at)
    `, [input.playerId])

    await client.query('COMMIT')
    const stats = player.rows[0]
    response.status(201).json({
      run: inserted.rows[0],
      player: {
        coins: stats.coins,
        bestScore: stats.best_score,
        stats: {
          gamesPlayed: stats.games_played,
          gamesWon: stats.games_won,
          totalStars: stats.total_stars,
          totalScore: Number(stats.total_score),
          highestMultiplier: stats.highest_multiplier,
          totalMathGain: Number(stats.total_math_gain),
        },
      },
    })
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
})
