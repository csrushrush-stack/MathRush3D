import { createHash, randomBytes } from 'node:crypto'
import type { NextFunction, Request, Response } from 'express'
import type { PoolClient } from 'pg'
import { pool } from './db/pool'

const SESSION_COOKIE = 'math_rush_session'
const SESSION_LIFETIME_MS = 30 * 24 * 60 * 60 * 1_000

function sessionCookieOptions() {
  const production = process.env.NODE_ENV === 'production'
  return {
    httpOnly: true,
    sameSite: production ? 'none' as const : 'lax' as const,
    secure: production,
    path: '/',
  }
}

declare global {
  namespace Express {
    interface Request {
      authPlayerId?: string
    }
  }
}

function hashToken(token: string) {
  return createHash('sha256').update(token).digest('hex')
}

function readCookie(request: Request, name: string) {
  const cookies = request.headers.cookie?.split(';') ?? []
  for (const cookie of cookies) {
    const separator = cookie.indexOf('=')
    if (separator < 0) continue
    if (cookie.slice(0, separator).trim() === name) {
      return decodeURIComponent(cookie.slice(separator + 1).trim())
    }
  }
  return null
}

export function readSessionToken(request: Request) {
  const authorization = request.get('authorization')
  if (authorization?.startsWith('Bearer ')) {
    const token = authorization.slice('Bearer '.length).trim()
    if (token) return token
  }
  return readCookie(request, SESSION_COOKIE)
}

export async function createSession(client: PoolClient, playerId: string, response: Response) {
  const token = randomBytes(32).toString('base64url')
  const expiresAt = new Date(Date.now() + SESSION_LIFETIME_MS)
  await client.query(
    'INSERT INTO auth_sessions (player_id, token_hash, expires_at) VALUES ($1, $2, $3)',
    [playerId, hashToken(token), expiresAt],
  )
  response.cookie(SESSION_COOKIE, token, {
    ...sessionCookieOptions(),
    maxAge: SESSION_LIFETIME_MS,
  })
  return token
}

export function clearSessionCookie(response: Response) {
  response.clearCookie(SESSION_COOKIE, sessionCookieOptions())
}

export async function resolveSession(request: Request) {
  const token = readSessionToken(request)
  if (!token) return null
  const result = await pool.query(`
    UPDATE auth_sessions
    SET last_used_at = now()
    WHERE token_hash = $1 AND expires_at > now()
    RETURNING player_id
  `, [hashToken(token)])
  return result.rows[0]?.player_id as string | undefined ?? null
}

export async function deleteSession(request: Request) {
  const token = readSessionToken(request)
  if (token) await pool.query('DELETE FROM auth_sessions WHERE token_hash = $1', [hashToken(token)])
}

export async function requireAuth(request: Request, response: Response, next: NextFunction) {
  const playerId = await resolveSession(request)
  if (!playerId) {
    clearSessionCookie(response)
    response.status(401).json({ error: 'Please sign in to continue' })
    return
  }
  request.authPlayerId = playerId
  next()
}

export function requireOwnPlayer(request: Request, response: Response, next: NextFunction) {
  if (request.authPlayerId !== request.params.playerId) {
    response.status(403).json({ error: 'You cannot change another player account' })
    return
  }
  next()
}
