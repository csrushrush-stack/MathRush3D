import { useState, type FormEvent } from 'react'
import { ApiError, loginAccount, registerAccount } from '../services/api'

interface AuthScreenProps {
  onAuthenticated: () => void
}

export function AuthScreen({ onAuthenticated }: AuthScreenProps) {
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      if (mode === 'register') {
        await registerAccount({ displayName, email, password })
      } else {
        await loginAccount(email, password)
      }
      onAuthenticated()
    } catch (submitError) {
      setError(submitError instanceof ApiError ? submitError.message : 'Could not connect to the game server')
    } finally {
      setSubmitting(false)
    }
  }

  const switchMode = (nextMode: 'login' | 'register') => {
    setMode(nextMode)
    setError('')
  }

  return (
    <main className="auth-page">
      <div className="auth-orb auth-orb-one" />
      <div className="auth-orb auth-orb-two" />
      <section className="auth-card" aria-labelledby="auth-title">
        <div className="auth-brand-mark" aria-hidden="true">
          <span>+</span><span>×</span><span>÷</span>
        </div>
        <p className="auth-eyebrow">THINK FAST · GROW BIG</p>
        <h1 id="auth-title">MATH <span>RUSH</span></h1>
        <p className="auth-subtitle">Build your crowd. Beat the boss. Own the bonus run.</p>

        <div className="auth-tabs" role="tablist" aria-label="Account options">
          <button type="button" role="tab" aria-selected={mode === 'login'} className={mode === 'login' ? 'active' : ''} onClick={() => switchMode('login')}>Log in</button>
          <button type="button" role="tab" aria-selected={mode === 'register'} className={mode === 'register' ? 'active' : ''} onClick={() => switchMode('register')}>Create account</button>
        </div>

        <form className="auth-form" onSubmit={submit}>
          {mode === 'register' && (
            <label>
              <span>Runner name</span>
              <input autoComplete="nickname" value={displayName} onChange={(event) => setDisplayName(event.target.value)} minLength={2} maxLength={32} placeholder="Number Ninja" required />
            </label>
          )}
          <label>
            <span>Email</span>
            <input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" required />
          </label>
          <label>
            <span>Password</span>
            <input type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} value={password} onChange={(event) => setPassword(event.target.value)} minLength={8} maxLength={128} placeholder="At least 8 characters" required />
          </label>
          {error && <div className="auth-error" role="alert">{error}</div>}
          <button className="auth-submit" type="submit" disabled={submitting}>
            {submitting ? 'Connecting…' : mode === 'login' ? 'Enter the rush' : 'Create runner'}
          </button>
        </form>
        <p className="auth-footnote">Your progress, skins, scores and run history are saved securely.</p>
      </section>
    </main>
  )
}
