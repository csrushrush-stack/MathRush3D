import { Router } from 'express'
import { requireAuth } from '../auth'
import { pool } from '../db/pool'

export const adminRouter = Router()

function adminEmails() {
  return (process.env.ADMIN_EMAILS ?? '')
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean)
}

async function isAdmin(playerId: string) {
  const allowed = adminEmails()
  if (!allowed.length) return false
  const account = await pool.query(
    'SELECT email FROM player_accounts WHERE player_id = $1',
    [playerId],
  )
  const email = account.rows[0]?.email as string | undefined
  return email ? allowed.includes(email.toLowerCase()) : false
}

adminRouter.use(requireAuth)

adminRouter.get('/summary', async (request, response) => {
  if (!request.authPlayerId || !(await isAdmin(request.authPlayerId))) {
    response.status(403).json({ error: 'Administrator access is required' })
    return
  }

  const [
    playerCount,
    accountCount,
    runCount,
    sessionCount,
    resetTokenCount,
    leaderboardCount,
    recentRuns,
  ] = await Promise.all([
    pool.query('SELECT COUNT(*)::int AS count FROM players'),
    pool.query('SELECT COUNT(*)::int AS count FROM player_accounts'),
    pool.query('SELECT COUNT(*)::int AS count FROM game_runs'),
    pool.query('SELECT COUNT(*)::int AS count FROM auth_sessions WHERE expires_at > now()'),
    pool.query('SELECT COUNT(*)::int AS count FROM password_reset_tokens WHERE used_at IS NULL AND expires_at > now()'),
    pool.query('SELECT COUNT(*)::int AS count FROM leaderboard'),
    pool.query(`
      SELECT difficulty, level, status, score, stars, ended_at
      FROM game_runs
      ORDER BY ended_at DESC
      LIMIT 5
    `),
  ])

  response.json({
    counts: {
      players: playerCount.rows[0].count,
      accounts: accountCount.rows[0].count,
      gameRuns: runCount.rows[0].count,
      activeSessions: sessionCount.rows[0].count,
      activeResetTokens: resetTokenCount.rows[0].count,
      leaderboardEntries: leaderboardCount.rows[0].count,
    },
    recentRuns: recentRuns.rows,
  })
})
