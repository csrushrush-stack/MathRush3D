import { useState, type FormEvent } from 'react'
import { ApiError, submitFeedback } from '../../services/api'

interface FeedbackModalProps {
  onClose: () => void
}

export function FeedbackModal({ onClose }: FeedbackModalProps) {
  const [category, setCategory] = useState<'bug' | 'idea' | 'other'>('idea')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [submitted, setSubmitted] = useState(false)

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      await submitFeedback({ category, message })
      setSubmitted(true)
    } catch (reason) {
      setError(reason instanceof ApiError ? reason.message : 'Feedback could not be sent. Check your connection and try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="feedback-overlay" onClick={onClose}>
      <section className="feedback-card" role="dialog" aria-modal="true" aria-labelledby="feedback-title" onClick={(event) => event.stopPropagation()}>
        <div className="feedback-heading"><div><p>PLAYER VOICE</p><h2 id="feedback-title">Share feedback</h2></div><button type="button" aria-label="Close feedback" onClick={onClose}>×</button></div>
        {submitted ? (
          <div className="feedback-success" role="status"><strong>Thanks, your feedback was saved.</strong><span>The project team can review it in the administrator dashboard.</span><button type="button" onClick={onClose}>Done</button></div>
        ) : (
          <form className="feedback-form" onSubmit={(event) => void submit(event)}>
            <label>Type<select value={category} onChange={(event) => setCategory(event.target.value as typeof category)}><option value="idea">Suggestion</option><option value="bug">Problem</option><option value="other">Other</option></select></label>
            <label>Your message<textarea required minLength={10} maxLength={2000} rows={5} value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Tell us what happened or what could be better." /></label>
            <small>{message.length}/2000 characters. Please do not include passwords or private details.</small>
            {error && <div className="feedback-error" role="alert">{error}</div>}
            <button className="feedback-submit" type="submit" disabled={busy || message.trim().length < 10}>{busy ? 'Sending...' : 'Send feedback'}</button>
          </form>
        )}
      </section>
    </div>
  )
}
