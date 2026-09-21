import { useState, type FormEvent } from 'react'
import {
  ApiError,
  loginAccount,
  registerAccount,
  requestPasswordReset,
  resetPassword,
} from '../services/api'

interface AuthScreenProps {
  onAuthenticated: () => void
}

type AuthMode = 'login' | 'register' | 'forgot' | 'reset'

function initialMode(): AuthMode {
  if (new URLSearchParams(window.location.search).has('token')) return 'reset'
  return window.location.pathname === '/forgot-password' ? 'forgot' : 'login'
}

export function AuthScreen({ onAuthenticated }: AuthScreenProps) {
  const [mode, setMode] = useState<AuthMode>(initialMode)
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [resetUrl, setResetUrl] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setError('')
    setMessage('')
    setResetUrl('')

    if (mode === 'reset' && password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    setSubmitting(true)
    try {
      if (mode === 'register') {
        await registerAccount({ displayName, email, password })
        onAuthenticated()
      } else if (mode === 'login') {
        await loginAccount(email, password)
        onAuthenticated()
      } else if (mode === 'forgot') {
        const result = await requestPasswordReset(email)
        setMessage(result.message)
        setResetUrl(result.resetUrl ?? '')
      } else {
        const token = new URLSearchParams(window.location.search).get('token') ?? ''
        const result = await resetPassword(token, password)
        window.history.replaceState({}, '', window.location.pathname)
        setMode('login')
        setPassword('')
        setConfirmPassword('')
        setMessage(result.message)
      }
    } catch (submitError) {
      setError(submitError instanceof ApiError ? submitError.message : 'Could not connect to the game server')
    } finally {
      setSubmitting(false)
    }
  }

  const switchMode = (nextMode: AuthMode) => {
    setMode(nextMode)
    setError('')
    setMessage('')
    setResetUrl('')
    setPassword('')
    setConfirmPassword('')
  }

  const subtitle = mode === 'forgot'
    ? 'Enter your account email to receive a secure reset link.'
    : mode === 'reset'
      ? 'Choose a new password for your runner account.'
      : window.location.pathname.startsWith('/admin')
        ? 'Sign in with an authorised admin account to review game activity.'
      : 'Build your crowd. Beat the boss. Own the bonus run.'

  return (
    <main className="auth-page">
      <div className="auth-orb auth-orb-one" />
      <div className="auth-orb auth-orb-two" />
      <section className="auth-card" aria-labelledby="auth-title">
        <div className="auth-brand-mark" aria-hidden="true">
          <span>+</span><span>×</span><span>÷</span>
        </div>
        <p className="auth-eyebrow">THINK FAST · GROW BIG</p>
        <h1 id="auth-title">{window.location.pathname.startsWith('/admin') ? 'ADMIN' : 'MATH'} <span>{window.location.pathname.startsWith('/admin') ? 'LOGIN' : 'RUSH'}</span></h1>
        <p className="auth-subtitle">{subtitle}</p>

        {(mode === 'login' || mode === 'register') && (
          <div className="auth-tabs" role="tablist" aria-label="Account options">
            <button type="button" role="tab" aria-selected={mode === 'login'} className={mode === 'login' ? 'active' : ''} onClick={() => switchMode('login')}>Log in</button>
            <button type="button" role="tab" aria-selected={mode === 'register'} className={mode === 'register' ? 'active' : ''} onClick={() => switchMode('register')}>Create account</button>
          </div>
        )}

        <form className="auth-form" onSubmit={submit}>
          {mode === 'register' && (
            <label>
              <span>Runner name</span>
              <input autoComplete="nickname" value={displayName} onChange={(event) => setDisplayName(event.target.value)} minLength={2} maxLength={32} placeholder="Number Ninja" required />
            </label>
          )}
          {mode !== 'reset' && (
            <label>
              <span>Email</span>
              <input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" required />
            </label>
          )}
          {mode !== 'forgot' && (
            <label>
              <span>{mode === 'reset' ? 'New password' : 'Password'}</span>
              <input type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} value={password} onChange={(event) => setPassword(event.target.value)} minLength={8} maxLength={128} placeholder="At least 8 characters" required />
            </label>
          )}
          {mode === 'login' && (
            <button className="auth-text-button auth-forgot-link" type="button" onClick={() => switchMode('forgot')}>Forgot password?</button>
          )}
          {mode === 'reset' && (
            <label>
              <span>Confirm new password</span>
              <input type="password" autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} minLength={8} maxLength={128} placeholder="Repeat your new password" required />
            </label>
          )}
          {error && <div className="auth-error" role="alert">{error}</div>}
          {message && <div className="auth-success" role="status">{message}</div>}
          {resetUrl && <a className="auth-dev-link" href={resetUrl}>Open local test reset link</a>}
          <button className="auth-submit" type="submit" disabled={submitting}>
            {submitting
              ? 'Please wait…'
              : mode === 'login'
                ? 'Enter the rush'
                : mode === 'register'
                  ? 'Create runner'
                  : mode === 'forgot'
                    ? 'Send reset link'
                    : 'Update password'}
          </button>
          {(mode === 'forgot' || mode === 'reset') && (
            <button className="auth-text-button auth-back-link" type="button" onClick={() => switchMode('login')}>Back to log in</button>
          )}
        </form>
        <p className="auth-footnote">Your progress, skins, scores and run history are saved securely.</p>
      </section>
    </main>
  )
}
