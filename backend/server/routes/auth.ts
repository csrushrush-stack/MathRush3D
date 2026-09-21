import bcrypt from 'bcryptjs'
import { Router, type Request } from 'express'
import { rateLimit } from 'express-rate-limit'
import { createSession, clearSessionCookie, deleteSession, requireAuth } from '../auth'
import { pool } from '../db/pool'
import { readProfile } from './players'
import {
  forgotPasswordSchema,
  loginSchema,
  registrationSchema,
  resetPasswordSchema,
} from '../validation'
import {
  buildPasswordResetUrl,
  createPasswordResetToken,
  hashPasswordResetToken,
  isPasswordResetExpired,
  sendPasswordResetEmail,
} from '../passwordReset'

export const authRouter = Router()

function mobileSessionResponse(request: Request, token: string) {
  return request.get('x-math-rush-client') === 'android' ? { sessionToken: token } : {}
}

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1_000,
  limit: 30,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'Too many sign-in attempts. Please try again shortly.' },
})

const passwordResetLimiter = rateLimit({
  windowMs: 15 * 60 * 1_000,
  limit: 5,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'Too many password reset attempts. Please try again shortly.' },
})

const RESET_RESPONSE = 'If that email is registered, a password reset link has been prepared.'

authRouter.post('/register', authLimiter, async (request, response) => {
  const input = registrationSchema.parse(request.body)
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const existingAccount = await client.query(
      'SELECT 1 FROM player_accounts WHERE lower(email) = lower($1)',
      [input.email],
    )
    if (existingAccount.rowCount) {
      await client.query('ROLLBACK')
      response.status(409).json({ error: 'An account already exists for this email' })
      return
    }

    const playerResult = await client.query(`
      INSERT INTO players (device_id, display_name)
      VALUES ($1, $2)
      ON CONFLICT (device_id) DO UPDATE SET
        display_name = EXCLUDED.display_name,
        last_seen_at = now()
      RETURNING id
    `, [input.deviceId, input.displayName])
    const playerId = playerResult.rows[0].id as string
    const linkedAccount = await client.query('SELECT 1 FROM player_accounts WHERE player_id = $1', [playerId])
    if (linkedAccount.rowCount) {
      await client.query('ROLLBACK')
      response.status(409).json({ error: 'This device is already linked to an account. Please sign in.' })
      return
    }

    await client.query('INSERT INTO player_progress (player_id) VALUES ($1) ON CONFLICT DO NOTHING', [playerId])
    await client.query('INSERT INTO player_settings (player_id) VALUES ($1) ON CONFLICT DO NOTHING', [playerId])
    await client.query("INSERT INTO player_skins (player_id, skin_id) VALUES ($1, 'default') ON CONFLICT DO NOTHING", [playerId])
    const passwordHash = await bcrypt.hash(input.password, 12)
    await client.query(
      'INSERT INTO player_accounts (player_id, email, password_hash) VALUES ($1, lower($2), $3)',
      [playerId, input.email, passwordHash],
    )
    const sessionToken = await createSession(client, playerId, response)
    const profile = await readProfile(client, playerId)
    await client.query('COMMIT')
    response.status(201).json({ profile, ...mobileSessionResponse(request, sessionToken) })
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
})

authRouter.post('/login', authLimiter, async (request, response) => {
  const input = loginSchema.parse(request.body)
  const account = await pool.query(`
    SELECT player_id, password_hash
    FROM player_accounts
    WHERE lower(email) = lower($1)
  `, [input.email])
  const row = account.rows[0]
  const passwordMatches = row ? await bcrypt.compare(input.password, row.password_hash) : false
  if (!row || !passwordMatches) {
    response.status(401).json({ error: 'Email or password is incorrect' })
    return
  }

  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    await client.query('UPDATE players SET last_seen_at = now() WHERE id = $1', [row.player_id])
    const sessionToken = await createSession(client, row.player_id, response)
    const profile = await readProfile(client, row.player_id)
    await client.query('COMMIT')
    response.json({ profile, ...mobileSessionResponse(request, sessionToken) })
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
})

authRouter.post('/forgot-password', passwordResetLimiter, async (request, response) => {
  const input = forgotPasswordSchema.parse(request.body)
  const account = await pool.query(
    'SELECT player_id, email FROM player_accounts WHERE lower(email) = lower($1)',
    [input.email],
  )
  const row = account.rows[0] as { player_id: string; email: string } | undefined
  if (!row) {
    response.json({ message: RESET_RESPONSE })
    return
  }

  const token = createPasswordResetToken()
  const tokenHash = hashPasswordResetToken(token)
  const resetUrl = buildPasswordResetUrl(token)
  await pool.query('DELETE FROM password_reset_tokens WHERE player_id = $1 OR expires_at <= now()', [row.player_id])
  await pool.query(`
    INSERT INTO password_reset_tokens (player_id, token_hash, expires_at)
    VALUES ($1, $2, now() + interval '15 minutes')
  `, [row.player_id, tokenHash])

  try {
    await sendPasswordResetEmail(row.email, resetUrl)
  } catch (error) {
    console.error('[password-reset] email delivery failed', error)
  }

  response.json({
    message: RESET_RESPONSE,
    ...(process.env.NODE_ENV === 'production' ? {} : { resetUrl }),
  })
})

authRouter.post('/reset-password', passwordResetLimiter, async (request, response) => {
  const input = resetPasswordSchema.parse(request.body)
  const tokenHash = hashPasswordResetToken(input.token)
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const tokenResult = await client.query(`
      SELECT id, player_id, expires_at, used_at
      FROM password_reset_tokens
      WHERE token_hash = $1
      FOR UPDATE
    `, [tokenHash])
    const tokenRow = tokenResult.rows[0] as {
      id: string
      player_id: string
      expires_at: Date
      used_at: Date | null
    } | undefined

    if (!tokenRow || tokenRow.used_at || isPasswordResetExpired(new Date(tokenRow.expires_at))) {
      await client.query('ROLLBACK')
      response.status(400).json({ error: 'This reset link is invalid or has expired' })
      return
    }

    const passwordHash = await bcrypt.hash(input.password, 12)
    await client.query(
      'UPDATE player_accounts SET password_hash = $1, updated_at = now() WHERE player_id = $2',
      [passwordHash, tokenRow.player_id],
    )
    await client.query('UPDATE password_reset_tokens SET used_at = now() WHERE id = $1', [tokenRow.id])
    await client.query('DELETE FROM auth_sessions WHERE player_id = $1', [tokenRow.player_id])
    await client.query('COMMIT')
    clearSessionCookie(response)
    response.json({ message: 'Password updated. You can now log in with the new password.' })
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
})

authRouter.get('/me', requireAuth, async (request, response) => {
  const client = await pool.connect()
  try {
    const profile = await readProfile(client, request.authPlayerId!)
    if (!profile) {
      response.status(404).json({ error: 'Player not found' })
      return
    }
    response.json({ profile })
  } finally {
    client.release()
  }
})

authRouter.post('/logout', async (request, response) => {
  await deleteSession(request)
  clearSessionCookie(response)
  response.status(204).end()
})
