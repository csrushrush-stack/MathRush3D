import { describe, expect, it } from 'vitest'
import {
  createPasswordResetToken,
  hashPasswordResetToken,
  isPasswordResetExpired,
} from './passwordReset'

describe('password reset tokens', () => {
  it('creates a high-entropy token and stores only its hash', () => {
    const token = createPasswordResetToken()
    expect(token).toMatch(/^[a-f0-9]{64}$/)
    expect(hashPasswordResetToken(token)).toMatch(/^[a-f0-9]{64}$/)
    expect(hashPasswordResetToken(token)).not.toBe(token)
  })

  it('uses deterministic hashing for database lookup', () => {
    expect(hashPasswordResetToken('sample-token')).toBe(hashPasswordResetToken('sample-token'))
    expect(hashPasswordResetToken('sample-token')).not.toBe(hashPasswordResetToken('different-token'))
  })

  it('recognises expired and active reset links', () => {
    const now = new Date('2026-09-10T12:00:00.000Z')
    expect(isPasswordResetExpired(new Date('2026-09-10T11:59:59.000Z'), now)).toBe(true)
    expect(isPasswordResetExpired(new Date('2026-09-10T12:15:00.000Z'), now)).toBe(false)
  })
})
