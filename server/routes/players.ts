import { Router } from 'express'
import type { PoolClient } from 'pg'
import { requireAuth, requireOwnPlayer } from '../auth'
import { pool } from '../db/pool'
import { progressSchema, sessionSchema, settingsSchema } from '../validation'

export const playersRouter = Router()

export async function readProfile(client: PoolClient, playerId: string) {
  const result = await client.query(`
    SELECT
      p.id,
      p.display_name,
      p.selected_skin,
      progress.coins,
      progress.best_score,
      progress.selected_difficulty,
      progress.selected_level,
      progress.easy_levels_completed,
      progress.medium_levels_completed,
      progress.hard_levels_completed,
      progress.expert_levels_completed,
      progress.games_played,
      progress.games_won,
      progress.total_stars,
      progress.total_score,
      progress.highest_multiplier,
      progress.total_math_gain,
      s.music,
      s.sound_effects,
      s.vibration,
      s.notifications,
      s.reduced_effects,
      COALESCE(array_agg(ps.skin_id) FILTER (WHERE ps.skin_id IS NOT NULL), ARRAY[]::text[]) AS owned_skins
    FROM players p
    JOIN player_progress progress ON progress.player_id = p.id
    JOIN player_settings s ON s.player_id = p.id
    LEFT JOIN player_skins ps ON ps.player_id = p.id
    WHERE p.id = $1
    GROUP BY p.id, progress.player_id, s.player_id
  `, [playerId])
  const row = result.rows[0]
  if (!row) return null
  return {
    id: row.id,
    displayName: row.display_name,
    coins: row.coins,
    bestScore: row.best_score,
    selectedSkin: row.selected_skin,
    selectedDifficulty: row.selected_difficulty,
    selectedLevel: row.selected_level,
    levelProgress: {
      easy: row.easy_levels_completed,
      medium: row.medium_levels_completed,
      hard: row.hard_levels_completed,
      expert: row.expert_levels_completed,
    },
    ownedSkins: row.owned_skins,
    settings: {
      music: row.music,
      soundEffects: row.sound_effects,
      vibration: row.vibration,
      notifications: row.notifications,
      reducedEffects: row.reduced_effects,
    },
    stats: {
      gamesPlayed: row.games_played,
      gamesWon: row.games_won,
      totalStars: row.total_stars,
      totalScore: Number(row.total_score),
      highestMultiplier: row.highest_multiplier,
      totalMathGain: Number(row.total_math_gain),
    },
  }
}

playersRouter.post('/session', async (request, response) => {
  const input = sessionSchema.parse(request.body)
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const playerResult = await client.query(`
      INSERT INTO players (device_id, display_name)
      VALUES ($1, COALESCE($2, 'Math Runner'))
      ON CONFLICT (device_id) DO UPDATE SET
        last_seen_at = now(),
        display_name = COALESCE($2, players.display_name)
      RETURNING id
    `, [input.deviceId, input.displayName ?? null])
    const playerId = playerResult.rows[0].id as string
    await client.query(`
      INSERT INTO player_progress (player_id) VALUES ($1)
      ON CONFLICT (player_id) DO NOTHING
    `, [playerId])
    await client.query(`
      INSERT INTO player_settings (player_id) VALUES ($1)
      ON CONFLICT (player_id) DO NOTHING
    `, [playerId])
    await client.query(`
      INSERT INTO player_skins (player_id, skin_id) VALUES ($1, 'default')
      ON CONFLICT DO NOTHING
    `, [playerId])
    const profile = await readProfile(client, playerId)
    await client.query('COMMIT')
    response.json({ profile })
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
})

playersRouter.use('/:playerId', requireAuth, requireOwnPlayer)

playersRouter.get('/:playerId/stats', async (request, response) => {
  const client = await pool.connect()
  try {
    const profile = await readProfile(client, request.params.playerId)
    if (!profile) {
      response.status(404).json({ error: 'Player not found' })
      return
    }
    const recent = await client.query(`
      SELECT id, difficulty, level, status, score, distance, multiplier, stars, ended_at
      FROM game_runs
      WHERE player_id = $1
      ORDER BY ended_at DESC
      LIMIT 10
    `, [request.params.playerId])
    response.json({ profile, recentRuns: recent.rows })
  } finally {
    client.release()
  }
})

playersRouter.patch('/:playerId/settings', async (request, response) => {
  const input = settingsSchema.parse(request.body)
  const result = await pool.query(`
    UPDATE player_settings SET
      music = COALESCE($2, music),
      sound_effects = COALESCE($3, sound_effects),
      vibration = COALESCE($4, vibration),
      notifications = COALESCE($5, notifications),
      reduced_effects = COALESCE($6, reduced_effects)
    WHERE player_id = $1
    RETURNING music, sound_effects, vibration, notifications, reduced_effects
  `, [
    request.params.playerId,
    input.music ?? null,
    input.soundEffects ?? null,
    input.vibration ?? null,
    input.notifications ?? null,
    input.reducedEffects ?? null,
  ])
  if (!result.rowCount) {
    response.status(404).json({ error: 'Player not found' })
    return
  }
  response.json({ settings: result.rows[0] })
})

playersRouter.patch('/:playerId/progress', async (request, response) => {
  const input = progressSchema.parse(request.body)
  const result = await pool.query(`
    UPDATE player_progress SET
      selected_difficulty = $2,
      selected_level = COALESCE($3, selected_level)
    WHERE player_id = $1
    RETURNING selected_difficulty, selected_level
  `, [request.params.playerId, input.selectedDifficulty, input.selectedLevel ?? null])
  if (!result.rowCount) {
    response.status(404).json({ error: 'Player not found' })
    return
  }
  response.json({ selectedDifficulty: result.rows[0].selected_difficulty, selectedLevel: result.rows[0].selected_level })
})

playersRouter.post('/:playerId/skins/:skinId/purchase', async (request, response) => {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const skin = await client.query('SELECT id, price FROM skins WHERE id = $1 AND is_available', [request.params.skinId])
    if (!skin.rowCount) {
      await client.query('ROLLBACK')
      response.status(404).json({ error: 'Skin not found' })
      return
    }
    const owned = await client.query(
      'SELECT 1 FROM player_skins WHERE player_id = $1 AND skin_id = $2',
      [request.params.playerId, request.params.skinId],
    )
    if (!owned.rowCount) {
      const charged = await client.query(`
        UPDATE player_progress SET coins = coins - $2
        WHERE player_id = $1 AND coins >= $2
        RETURNING coins
      `, [request.params.playerId, skin.rows[0].price])
      if (!charged.rowCount) {
        await client.query('ROLLBACK')
        response.status(409).json({ error: 'Not enough coins' })
        return
      }
      await client.query(
        'INSERT INTO player_skins (player_id, skin_id) VALUES ($1, $2)',
        [request.params.playerId, request.params.skinId],
      )
    }
    const updated = await client.query(`
      UPDATE players SET selected_skin = $2 WHERE id = $1
      RETURNING selected_skin
    `, [request.params.playerId, request.params.skinId])
    const progress = await client.query(
      'SELECT coins FROM player_progress WHERE player_id = $1',
      [request.params.playerId],
    )
    await client.query('COMMIT')
    response.json({ coins: progress.rows[0].coins, selectedSkin: updated.rows[0].selected_skin })
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
})
