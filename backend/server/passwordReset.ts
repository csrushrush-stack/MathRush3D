import { createHash, randomBytes } from 'node:crypto'

const DEFAULT_RESET_ORIGIN = 'http://localhost:5173'

export function createPasswordResetToken() {
  return randomBytes(32).toString('hex')
}

export function hashPasswordResetToken(token: string) {
  return createHash('sha256').update(token).digest('hex')
}

export function isPasswordResetExpired(expiresAt: Date, now = new Date()) {
  return expiresAt.getTime() <= now.getTime()
}

export function buildPasswordResetUrl(token: string) {
  const configuredOrigin = process.env.PUBLIC_APP_URL
    ?? process.env.CLIENT_ORIGIN?.split(',')[0]?.trim()
    ?? DEFAULT_RESET_ORIGIN
  const url = new URL('/reset-password', configuredOrigin)
  url.searchParams.set('token', token)
  return url.toString()
}

export async function sendPasswordResetEmail(email: string, resetUrl: string) {
  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.PASSWORD_RESET_FROM_EMAIL
  if (!apiKey || !from) return false

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'Idempotency-Key': `password-reset-${hashPasswordResetToken(resetUrl)}`,
    },
    body: JSON.stringify({
      from,
      to: [email],
      subject: 'Reset your Math Rush 3D password',
      html: [
        '<p>A password reset was requested for your Math Rush 3D account.</p>',
        `<p><a href="${resetUrl}">Reset password</a></p>`,
        '<p>This link expires in 15 minutes. If this was not you, ignore this email.</p>',
      ].join(''),
      text: `Reset your Math Rush 3D password: ${resetUrl}\n\nThis link expires in 15 minutes. If this was not you, ignore this email.`,
    }),
  })

  if (!response.ok) {
    const details = await response.text()
    throw new Error(`Password reset email failed with status ${response.status}: ${details.slice(0, 300)}`)
  }
  return true
}
