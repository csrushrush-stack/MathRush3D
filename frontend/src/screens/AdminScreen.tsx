import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ApiError,
  archiveAdminSkin,
  createAdminSkin,
  deactivateAdminPlayer,
  deleteAdminFeedback,
  fetchAdminAudit,
  fetchAdminFeedback,
  fetchAdminPlayers,
  fetchAdminRuns,
  fetchAdminSkins,
  fetchAdminSummary,
  logoutAccount,
  setAdminRole,
  updateAdminFeedback,
  updateAdminPlayer,
  updateAdminSkin,
  type AdminAuditEvent,
  type AdminFeedback,
  type AdminPlayer,
  type AdminRun,
  type AdminSummary,
  type ApiSkin,
  type FeedbackStatus,
} from '../services/api'

interface AdminScreenProps {
  onLogout: () => void
}

type AdminTab = 'Overview' | 'Players' | 'Runs' | 'Skins' | 'Feedback' | 'Audit log'
const tabs: AdminTab[] = ['Overview', 'Players', 'Runs', 'Skins', 'Feedback', 'Audit log']
const countLabels: Record<keyof AdminSummary['counts'], string> = {
  players: 'Players',
  accounts: 'Accounts',
  gameRuns: 'Game runs',
  activeSessions: 'Active sessions',
  activeResetTokens: 'Reset tokens',
  leaderboardEntries: 'Leaderboard entries',
  feedback: 'Feedback items',
}
const feedbackStatuses: FeedbackStatus[] = ['new', 'reviewing', 'accepted', 'declined', 'resolved']

const emptySkin = {
  id: '', name: '', primary: '#22aaff', secondary: '#153e75', accent: '#c9f1ff',
  head: '#ffe0bd', glow: '#38bdf8', price: 500, rarity: 'Common' as const,
}

export function AdminScreen({ onLogout }: AdminScreenProps) {
  const [tab, setTab] = useState<AdminTab>('Overview')
  const [summary, setSummary] = useState<AdminSummary | null>(null)
  const [players, setPlayers] = useState<AdminPlayer[]>([])
  const [runs, setRuns] = useState<AdminRun[]>([])
  const [skins, setSkins] = useState<ApiSkin[]>([])
  const [feedback, setFeedback] = useState<AdminFeedback[]>([])
  const [events, setEvents] = useState<AdminAuditEvent[]>([])
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<FeedbackStatus | ''>('')
  const [runFilter, setRunFilter] = useState<'won' | 'lost' | ''>('')
  const [difficultyFilter, setDifficultyFilter] = useState('')
  const [playerActive, setPlayerActive] = useState<'all' | 'active' | 'inactive'>('all')
  const [newSkin, setNewSkin] = useState(emptySkin)
  const [nameDrafts, setNameDrafts] = useState<Record<string, string>>({})
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [loading, setLoading] = useState(true)

  const showError = useCallback((reason: unknown) => {
    setError(reason instanceof ApiError ? reason.message : reason instanceof Error ? reason.message : 'The request could not be completed.')
    setNotice('')
  }, [])

  const loadSummary = useCallback(async () => setSummary(await fetchAdminSummary()), [])

  const refreshTab = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      if (tab === 'Overview') await loadSummary()
      if (tab === 'Players') {
        const result = await fetchAdminPlayers(search, playerActive === 'all' ? undefined : playerActive === 'active')
        setPlayers(result.players)
      }
      if (tab === 'Runs') {
        const result = await fetchAdminRuns(search, (difficultyFilter || undefined) as AdminRun['difficulty'] | undefined, runFilter)
        setRuns(result.runs)
      }
      if (tab === 'Skins') {
        const result = await fetchAdminSkins(search)
        setSkins(result.skins)
      }
      if (tab === 'Feedback') {
        const result = await fetchAdminFeedback(search, statusFilter)
        setFeedback(result.feedback)
      }
      if (tab === 'Audit log') {
        const result = await fetchAdminAudit(search)
        setEvents(result.events)
      }
    } catch (loadError) {
      showError(loadError)
    } finally {
      setLoading(false)
    }
  }, [tab, search, playerActive, difficultyFilter, runFilter, statusFilter, loadSummary, showError])

  useEffect(() => { void refreshTab() }, [refreshTab])

  const signOut = async () => {
    await logoutAccount()
    onLogout()
  }

  const runAction = async (action: () => Promise<unknown>, message: string) => {
    setBusy(true)
    setError('')
    try {
      await action()
      setNotice(message)
      await refreshTab()
    } catch (reason) {
      showError(reason)
    } finally {
      setBusy(false)
    }
  }

  const summaryCounts = useMemo(() => summary ? (Object.keys(countLabels) as Array<keyof AdminSummary['counts']>) : [], [summary])

  return (
    <main className="admin-page">
      <section className="admin-shell" aria-labelledby="admin-title">
        <div className="admin-header">
          <div>
            <p className="admin-eyebrow">MATH RUSH 3D</p>
            <h1 id="admin-title">Administrator dashboard</h1>
            <p>Search player accounts and runs, manage the skin catalogue, review feedback and inspect recorded admin actions.</p>
          </div>
          <button type="button" onClick={signOut}>Log out</button>
        </div>

        <nav className="admin-nav" aria-label="Administrator sections">
          {tabs.map((item) => (
            <button type="button" key={item} className={tab === item ? 'active' : ''} onClick={() => { setTab(item); setSearch(''); setNotice('') }}>
              {item}
            </button>
          ))}
        </nav>

        {error && <div className="admin-error" role="alert">{error}</div>}
        {notice && <div className="admin-notice" role="status">{notice}</div>}
        {loading && <div className="admin-state">Loading {tab.toLowerCase()} data...</div>}

        {tab !== 'Overview' && (
          <div className="admin-toolbar">
            <label className="admin-search">Search <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={`Search ${tab.toLowerCase()}...`} /></label>
            {tab === 'Players' && (
              <label>Account status <select value={playerActive} onChange={(event) => setPlayerActive(event.target.value as typeof playerActive)}>
                <option value="all">All</option><option value="active">Active</option><option value="inactive">Inactive</option>
              </select></label>
            )}
            {tab === 'Runs' && <>
              <label>Difficulty <select value={difficultyFilter} onChange={(event) => setDifficultyFilter(event.target.value)}>
                <option value="">All difficulties</option><option>easy</option><option>medium</option><option>hard</option><option>expert</option>
              </select></label>
              <label>Result <select value={runFilter} onChange={(event) => setRunFilter(event.target.value as typeof runFilter)}>
                <option value="">All results</option><option value="won">Won</option><option value="lost">Lost</option>
              </select></label>
            </>}
            {tab === 'Feedback' && <label>Status <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as FeedbackStatus | '')}>
              <option value="">All statuses</option>{feedbackStatuses.map((value) => <option key={value}>{value}</option>)}
            </select></label>}
          </div>
        )}

        {tab === 'Overview' && summary && (
          <>
            <div className="admin-grid">
              {summaryCounts.map((key) => (
                <article className="admin-stat" key={key}><span>{countLabels[key]}</span><strong>{summary.counts[key]}</strong></article>
              ))}
            </div>
            <section className="admin-panel" aria-labelledby="recent-runs-title">
              <h2 id="recent-runs-title">Recent runs</h2>
              {summary.recentRuns.length === 0 ? <p>No recent game runs recorded yet.</p> : (
                <div className="admin-table"><div className="admin-row admin-row-head admin-run-row"><span>Difficulty</span><span>Level</span><span>Result</span><span>Score</span><span>Stars</span></div>
                  {summary.recentRuns.map((run, index) => <div className="admin-row admin-run-row" key={`${run.ended_at}-${index}`}>
                    <span>{run.difficulty}</span><span>{run.level}</span><span>{run.status}</span><span>{run.score}</span><span>{run.stars}</span>
                  </div>)}
                </div>
              )}
            </section>
          </>
        )}

        {tab === 'Players' && !loading && (
          <section className="admin-panel"><h2>Player accounts</h2>
            {players.length === 0 ? <p>No matching players found.</p> : players.map((player) => (
              <article className="admin-record" key={player.id}>
                <div className="admin-record-main">
                  <strong>{player.email ?? 'Guest account'}</strong><small>{player.gamesPlayed} runs · {player.gamesWon} wins · best {player.bestScore.toLocaleString()}</small>
                  <code>{player.id}</code>
                </div>
                <label>Display name<input value={nameDrafts[player.id] ?? player.displayName} onChange={(event) => setNameDrafts((value) => ({ ...value, [player.id]: event.target.value }))} /></label>
                <div className="admin-record-actions">
                  <button disabled={busy} onClick={() => void runAction(() => updateAdminPlayer(player.id, { displayName: nameDrafts[player.id] ?? player.displayName }), 'Player details saved.')}>Save</button>
                  {player.email && <button disabled={busy} onClick={() => void runAction(() => updateAdminPlayer(player.id, { isActive: !player.isActive }), player.isActive ? 'Account deactivated.' : 'Account reactivated.')}>{player.isActive ? 'Deactivate' : 'Reactivate'}</button>}
                  {player.email && <button disabled={busy} onClick={() => void runAction(() => setAdminRole(player.id, !player.isAdmin), player.isAdmin ? 'Administrator role removed.' : 'Administrator role granted.')}>{player.isAdmin ? 'Remove admin' : 'Make admin'}</button>}
                  {player.email && player.isActive && <button className="danger" disabled={busy} onClick={() => void runAction(() => deactivateAdminPlayer(player.id), 'Account deactivated and active sessions removed.')}>Disable account</button>}
                </div>
              </article>
            ))}
          </section>
        )}

        {tab === 'Runs' && !loading && (
          <section className="admin-panel"><h2>Game runs</h2>
            {runs.length === 0 ? <p>No matching game runs found.</p> : runs.map((run) => <article className="admin-record" key={run.id}>
              <div className="admin-record-main"><strong>{run.displayName} · {run.status.toUpperCase()}</strong><small>{run.difficulty}, level {run.level} · {run.score.toLocaleString()} points · {run.stars} stars · {run.coinsEarned} coins</small><code>{run.id}</code></div>
              <time>{new Date(run.endedAt).toLocaleString()}</time>
            </article>)}
          </section>
        )}

        {tab === 'Skins' && !loading && (
          <section className="admin-panel"><h2>Skin catalogue</h2>
            <form className="admin-skin-form" onSubmit={(event) => {
              event.preventDefault()
              void runAction(async () => {
                await createAdminSkin({ ...newSkin, sortOrder: skins.length + 1, isAvailable: true })
                setNewSkin(emptySkin)
              }, 'Skin added to the game catalogue.')
            }}>
              <h3>Add a skin</h3>
              <label>ID<input required minLength={2} maxLength={32} pattern="[a-z0-9_-]+" value={newSkin.id} onChange={(event) => setNewSkin({ ...newSkin, id: event.target.value })} /></label>
              <label>Name<input required minLength={2} maxLength={40} value={newSkin.name} onChange={(event) => setNewSkin({ ...newSkin, name: event.target.value })} /></label>
              <label>Price<input type="number" min={0} max={100000} value={newSkin.price} onChange={(event) => setNewSkin({ ...newSkin, price: Number(event.target.value) })} /></label>
              <label>Rarity<select value={newSkin.rarity} onChange={(event) => setNewSkin({ ...newSkin, rarity: event.target.value as typeof newSkin.rarity })}>
                <option>Common</option><option>Rare</option><option>Epic</option><option>Legendary</option>
              </select></label>
              {(['primary', 'secondary', 'accent', 'head', 'glow'] as const).map((color) => <label key={color}>{color}<input type="color" value={newSkin[color]} onChange={(event) => setNewSkin({ ...newSkin, [color]: event.target.value })} /></label>)}
              <button disabled={busy} type="submit">Add skin</button>
            </form>
            {skins.map((skin) => <SkinEditor key={skin.id} skin={skin} busy={busy} onSave={(input) => runAction(() => updateAdminSkin(skin.id, input), 'Skin changes saved.')} onArchive={() => runAction(() => archiveAdminSkin(skin.id), 'Skin archived from the player shop.')} />)}
          </section>
        )}

        {tab === 'Feedback' && !loading && (
          <section className="admin-panel"><h2>Player feedback</h2>
            {feedback.length === 0 ? <p>No matching feedback found.</p> : feedback.map((item) => <FeedbackEditor
              key={item.id} item={item} status={item.status} note={noteDrafts[item.id] ?? item.adminNote ?? ''}
              onStatusChange={(value) => setFeedback((current) => current.map((row) => row.id === item.id ? { ...row, status: value } : row))}
              onNoteChange={(value) => setNoteDrafts((current) => ({ ...current, [item.id]: value }))}
              onSave={() => runAction(() => updateAdminFeedback(item.id, { status: item.status, adminNote: noteDrafts[item.id] ?? item.adminNote ?? '' }), 'Feedback review saved.')}
              onDelete={() => runAction(() => deleteAdminFeedback(item.id), 'Feedback item deleted.')}
              busy={busy}
            />)}
          </section>
        )}

        {tab === 'Audit log' && !loading && (
          <section className="admin-panel"><h2>Administrative actions</h2>
            {events.length === 0 ? <p>No matching admin actions have been logged.</p> : events.map((event) => <article className="admin-record" key={event.id}>
              <div className="admin-record-main"><strong>{event.action}</strong><small>{event.entityType} {event.entityId ?? ''} · by {event.actorName ?? 'system setup'}</small><code>{JSON.stringify(event.details)}</code></div>
              <time>{new Date(event.createdAt).toLocaleString()}</time>
            </article>)}
          </section>
        )}
      </section>
    </main>
  )
}

function SkinEditor({
  skin,
  busy,
  onSave,
  onArchive,
}: {
  skin: ApiSkin
  busy: boolean
  onSave: (input: Partial<Omit<ApiSkin, 'id'>>) => Promise<void>
  onArchive: () => Promise<void>
}) {
  const [draft, setDraft] = useState(skin)
  useEffect(() => setDraft(skin), [skin])
  const edit = (key: keyof ApiSkin, value: string | number) => setDraft((current) => ({ ...current, [key]: value }))
  return <article className="admin-skin-card">
    <div className="admin-skin-preview" style={{ background: `radial-gradient(circle, ${draft.glow}55, #0f172a 72%)` }} aria-hidden="true">♟</div>
    <div className="admin-skin-fields">
      <strong>{draft.id}</strong>
      <label>Name<input value={draft.name} onChange={(event) => edit('name', event.target.value)} /></label>
      <label>Price<input type="number" min={0} max={100000} value={draft.price} onChange={(event) => edit('price', Number(event.target.value))} /></label>
      <label>Rarity<select value={draft.rarity} onChange={(event) => edit('rarity', event.target.value)}>
        <option>Starter</option><option>Common</option><option>Rare</option><option>Epic</option><option>Legendary</option>
      </select></label>
      {(['primary', 'secondary', 'accent', 'head', 'glow'] as const).map((color) => <label key={color}>{color}<input type="color" value={draft[color]} onChange={(event) => edit(color, event.target.value)} /></label>)}
      <div className="admin-record-actions">
        <button disabled={busy} onClick={() => void onSave({ name: draft.name, price: draft.price, rarity: draft.rarity, primary: draft.primary, secondary: draft.secondary, accent: draft.accent, head: draft.head, glow: draft.glow })}>Save</button>
        <button className="danger" disabled={busy || draft.id === 'default' || !draft.isAvailable} onClick={() => void onArchive()}>{draft.isAvailable ? 'Archive' : 'Archived'}</button>
      </div>
    </div>
  </article>
}

function FeedbackEditor({
  item,
  status,
  note,
  onStatusChange,
  onNoteChange,
  onSave,
  onDelete,
  busy,
}: {
  item: AdminFeedback
  status: FeedbackStatus
  note: string
  onStatusChange: (value: FeedbackStatus) => void
  onNoteChange: (value: string) => void
  onSave: () => void
  onDelete: () => void
  busy: boolean
}) {
  return <article className="admin-feedback-card">
    <div className="admin-feedback-heading"><strong>{item.category.toUpperCase()} · {item.displayName ?? 'Unknown player'}</strong><time>{new Date(item.createdAt).toLocaleString()}</time></div>
    <p>{item.message}</p>
    <div className="admin-feedback-controls">
      <label>Status<select value={status} onChange={(event) => onStatusChange(event.target.value as FeedbackStatus)}>{feedbackStatuses.map((value) => <option key={value}>{value}</option>)}</select></label>
      <label>Review note<input maxLength={1000} value={note} onChange={(event) => onNoteChange(event.target.value)} /></label>
    </div>
    <div className="admin-record-actions"><button disabled={busy} onClick={onSave}>Save review</button><button className="danger" disabled={busy} onClick={onDelete}>Delete feedback</button></div>
  </article>
}
