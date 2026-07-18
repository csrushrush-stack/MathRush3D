/**
 * GameScreen – Portrait-mobile gameplay screen for Math Rush 3D.
 *
 * Layout:
 *   Wrapped in the same phone-shell (9:16) as HomeScreen so the
 *   gameplay feels like a real mobile game, not a desktop prototype.
 *
 *   ┌──────────────────────┐
 *   │  🏃 × 1   ⚡ 0m  ⏸  │  ← top bar
 *   │  [ HARD MODE ]       │  ← difficulty badge
 *   │                      │
 *   │   ┌──────────────┐   │
 *   │   │  3D GAME SCENE│  │  ← R3F canvas fills the shell
 *   │   │              │   │
 *   │   │              │   │
 *   │   └──────────────┘   │
 *   │                      │
 *   │    A / ← → / D       │  ← controls hint
 *   └──────────────────────┘
 *
 * The crowd counter is the most prominent HUD element.
 * It flashes green/red whenever the crowd size changes.
 */
import {
  useEffect, useCallback, useState, useRef, type CSSProperties,
} from 'react'
import { GameScene }    from '../components/game/GameScene'
import { useGameStore } from '../store/useGameStore'
import { audioManager } from '../utils/audioManager'
import { saveSelectedDifficulty, submitCompletedRun } from '../services/api'
import { getNextLevelSelection } from '../utils/levelProgress'

// ─── Design tokens (same glass style as HomeScreen) ────────────────────────

const GLASS: CSSProperties = {
  backdropFilter: 'blur(14px)',
  WebkitBackdropFilter: 'blur(14px)',
  background: 'linear-gradient(155deg, rgba(23,55,135,0.90), rgba(29,78,216,0.84))',
  border: '1.5px solid rgba(96,165,250,0.40)',
  boxShadow: '0 4px 18px rgba(0,0,0,0.40), inset 0 1px 0 rgba(255,255,255,0.09)',
}

// ─── Crowd counter pill ─────────────────────────────────────────────────────
// The most important HUD element — large, animated, centred.

function CrowdCounter({ count }: { count: number }) {
  const prevRef = useRef(count)
  const [flash, setFlash] = useState<'gain' | 'loss' | null>(null)

  useEffect(() => {
    if (count !== prevRef.current) {
      setFlash(count > prevRef.current ? 'gain' : 'loss')
      prevRef.current = count
      const t = setTimeout(() => setFlash(null), 700)
      return () => clearTimeout(t)
    }
  }, [count])

  const bg =
    flash === 'gain' ? 'linear-gradient(155deg,rgba(22,163,74,0.92),rgba(34,197,94,0.88))' :
    flash === 'loss' ? 'linear-gradient(155deg,rgba(185,28,28,0.92),rgba(239,68,68,0.88))'  :
    GLASS.background as string

  const border =
    flash === 'gain' ? '2px solid rgba(134,239,172,0.70)' :
    flash === 'loss' ? '2px solid rgba(252,165,165,0.70)' :
    '2px solid rgba(96,165,250,0.45)'

  return (
    <div
      className="flex items-center gap-2.5 px-4 py-2 rounded-2xl select-none"
      style={{
        ...GLASS,
        background: bg,
        border,
        boxShadow: flash
          ? `0 0 24px ${flash === 'gain' ? 'rgba(74,222,128,0.55)' : 'rgba(248,113,113,0.55)'}, 0 4px 18px rgba(0,0,0,0.4)`
          : GLASS.boxShadow,
        transition: 'background 0.18s ease, border 0.18s ease, box-shadow 0.18s ease',
      }}
    >
      {/* Running figure icon */}
      <span style={{ fontSize: 18, lineHeight: 1, filter: 'drop-shadow(0 1px 3px rgba(0,0,0,0.5))' }}>
        🏃
      </span>

      {/* Count */}
      <span
        style={{
          fontWeight: 900,
          fontSize: 22,
          color: '#ffffff',
          letterSpacing: '-0.03em',
          fontVariantNumeric: 'tabular-nums',
          lineHeight: 1,
          display: 'inline-block',
          transform: flash ? 'scale(1.20)' : 'scale(1)',
          transition: 'transform 0.15s cubic-bezier(0.34,1.56,0.64,1)',
          textShadow: '0 1px 4px rgba(0,0,0,0.5)',
        }}
      >
        {count}
      </span>

      {/* Label */}
      <span
        style={{
          fontSize: 8,
          fontWeight: 700,
          letterSpacing: '0.14em',
          color: flash ? 'rgba(255,255,255,0.90)' : '#7dd3fc',
          textTransform: 'uppercase',
          lineHeight: 1,
          paddingTop: 2,
          transition: 'color 0.18s ease',
        }}
      >
        CROWD
      </span>
    </div>
  )
}

// ─── Distance pill ──────────────────────────────────────────────────────────

function DistancePill({ meters }: { meters: number }) {
  return (
    <div
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full select-none"
      style={GLASS}
    >
      <span style={{ fontSize: 12, lineHeight: 1 }}>⚡</span>
      <span
        style={{
          fontSize: 13,
          fontWeight: 900,
          color: '#fbbf24',
          letterSpacing: '-0.01em',
          fontVariantNumeric: 'tabular-nums',
          textShadow: '0 0 10px rgba(251,191,36,0.5)',
        }}
      >
        {meters.toLocaleString()}
        <span style={{ fontSize: 9, fontWeight: 600, color: 'rgba(251,191,36,0.65)', marginLeft: 2 }}>m</span>
      </span>
    </div>
  )
}

// ─── Pause / Home button ────────────────────────────────────────────────────

function IconButton({
  id, onClick, children, ariaLabel,
}: {
  id: string
  onClick: () => void
  children: React.ReactNode
  ariaLabel: string
}) {
  return (
    <button
      id={id}
      onClick={onClick}
      aria-label={ariaLabel}
      className="flex items-center justify-center rounded-full select-none"
      style={{
        width: 38,
        height: 38,
        ...GLASS,
        border: '1.5px solid rgba(96,165,250,0.50)',
        transition: 'filter 0.1s ease, transform 0.1s ease',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.filter = 'brightness(1.15)' }}
      onMouseLeave={(e) => { e.currentTarget.style.filter = 'brightness(1)' }}
      onMouseDown={(e)  => { e.currentTarget.style.transform = 'scale(0.90)' }}
      onMouseUp={(e)    => { e.currentTarget.style.transform = 'scale(1)' }}
      onTouchStart={(e) => { e.currentTarget.style.transform = 'scale(0.90)' }}
      onTouchEnd={(e)   => { e.currentTarget.style.transform = 'scale(1)' }}
    >
      {children}
    </button>
  )
}

// ─── Pause overlay ──────────────────────────────────────────────────────────

function PauseOverlay({ onResume, onRestart, onHome }: { onResume: () => void; onRestart: () => void; onHome: () => void }) {
  return (
    <div
      className="absolute inset-0 flex flex-col items-center justify-center"
      style={{ background: 'rgba(2,6,23,0.82)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' }}
    >
      <div
        className="flex flex-col items-center gap-5 rounded-3xl"
        style={{
          padding: '32px 36px',
          background: 'linear-gradient(160deg, rgba(23,55,135,0.97), rgba(29,78,216,0.93))',
          border: '2px solid rgba(96,165,250,0.50)',
          boxShadow: '0 24px 60px rgba(0,0,0,0.65), inset 0 1px 0 rgba(255,255,255,0.08)',
          minWidth: 230,
        }}
      >
        {/* Icon + title */}
        <div className="text-center">
          <div style={{ fontSize: 40, lineHeight: 1, marginBottom: 6 }}>⏸</div>
          <h2 className="text-white font-black" style={{ fontSize: 22, letterSpacing: '0.14em' }}>
            PAUSED
          </h2>
        </div>

        {/* Resume */}
        <button
          id="resume-button"
          onClick={onResume}
          className="w-full flex items-center justify-center gap-2 rounded-2xl font-black text-white"
          style={{
            height: 54,
            fontSize: 16,
            letterSpacing: '0.10em',
            background: 'linear-gradient(180deg, #4ade80 0%, #22c55e 35%, #16a34a 70%, #15803d 100%)',
            border: '2px solid #86efac',
            boxShadow: '0 5px 0 #14532d, 0 8px 24px rgba(22,163,74,0.45)',
            transition: 'transform 0.1s, filter 0.1s',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.filter = 'brightness(1.08)' }}
          onMouseLeave={(e) => { e.currentTarget.style.filter = 'brightness(1)' }}
          onMouseDown={(e)  => { e.currentTarget.style.transform = 'translateY(2px)' }}
          onMouseUp={(e)    => { e.currentTarget.style.transform = 'none' }}
          onTouchStart={(e) => { e.currentTarget.style.transform = 'translateY(2px)' }}
          onTouchEnd={(e)   => { e.currentTarget.style.transform = 'none' }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <path d="M8 5v14l11-7z" />
          </svg>
          RESUME
        </button>

        <button
          id="restart-button"
          onClick={onRestart}
          className="w-full flex items-center justify-center gap-2 rounded-2xl font-black text-white"
          style={{ height: 48, fontSize: 13, letterSpacing: '0.08em', background: 'linear-gradient(180deg,#f59e0b,#d97706)', border: '2px solid #fcd34d', boxShadow: '0 4px 0 #78350f' }}
        >
          ↻ RESTART LEVEL
        </button>

        {/* Home */}
        <button
          id="home-button"
          onClick={onHome}
          className="w-full flex items-center justify-center gap-2 rounded-2xl font-semibold"
          style={{
            height: 46,
            fontSize: 13,
            letterSpacing: '0.06em',
            color: '#93c5fd',
            background: 'rgba(255,255,255,0.07)',
            border: '1.5px solid rgba(96,165,250,0.35)',
            transition: 'filter 0.1s, background 0.1s, color 0.1s',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.14)'; e.currentTarget.style.color = '#ffffff' }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.07)'; e.currentTarget.style.color = '#93c5fd' }}
        >
          ← Back to Home
        </button>
      </div>
    </div>
  )
}

// ─── Game Over overlay ────────────────────────────────────────────────

function GameOverOverlay({
  distance,
  score,
  onRetry,
  onHome,
}: {
  distance: number
  score: number
  onRetry: () => void
  onHome: () => void
}) {
  return (
    <div
      className="absolute inset-0 flex flex-col items-center justify-center"
      style={{ background: 'rgba(2,6,23,0.86)', backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)' }}
    >
      <div
        className="flex flex-col items-center gap-5 rounded-3xl"
        style={{
          padding: '32px 40px',
          background: 'linear-gradient(160deg, rgba(127,18,18,0.95), rgba(185,28,28,0.90))',
          border: '2px solid rgba(252,165,165,0.45)',
          boxShadow: '0 24px 60px rgba(0,0,0,0.70), inset 0 1px 0 rgba(255,255,255,0.07)',
          minWidth: 240,
        }}
      >
        {/* Icon + title */}
        <div className="text-center">
          <div style={{ fontSize: 52, lineHeight: 1, marginBottom: 8 }}>💥</div>
          <h2
            className="text-white font-black"
            style={{ fontSize: 26, letterSpacing: '0.10em', textShadow: '0 0 20px rgba(239,68,68,0.8)' }}
          >
            GAME OVER
          </h2>
        </div>

        {/* Distance reached */}
        <div
          className="rounded-2xl flex flex-col items-center gap-1 w-full"
          style={{
            padding: '12px 0',
            background: 'rgba(0,0,0,0.30)',
            border: '1px solid rgba(252,165,165,0.20)',
          }}
        >
          <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.16em', color: 'rgba(252,165,165,0.70)', textTransform: 'uppercase' }}>
            Distance reached
          </span>
          <span
            style={{
              fontSize: 30,
              fontWeight: 900,
              color: '#ffffff',
              letterSpacing: '-0.02em',
              textShadow: '0 0 16px rgba(239,68,68,0.6)',
            }}
          >
            {distance.toLocaleString()}
            <span style={{ fontSize: 14, fontWeight: 600, color: 'rgba(255,255,255,0.5)', marginLeft: 3 }}>m</span>
          </span>
        </div>

        <div style={{ color: '#fde68a', fontWeight: 900, fontSize: 18 }}>
          {score.toLocaleString()} points
        </div>

        {/* TRY AGAIN */}
        <button
          id="retry-button"
          onClick={onRetry}
          className="w-full flex items-center justify-center gap-2 rounded-2xl font-black text-white"
          style={{
            height: 54,
            fontSize: 16,
            letterSpacing: '0.10em',
            background: 'linear-gradient(180deg, #4ade80 0%, #22c55e 35%, #16a34a 70%, #15803d 100%)',
            border: '2px solid #86efac',
            boxShadow: '0 5px 0 #14532d, 0 8px 24px rgba(22,163,74,0.45)',
            transition: 'transform 0.1s, filter 0.1s',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.filter = 'brightness(1.08)' }}
          onMouseLeave={(e) => { e.currentTarget.style.filter = 'brightness(1)' }}
          onMouseDown={(e)  => { e.currentTarget.style.transform = 'translateY(2px)' }}
          onMouseUp={(e)    => { e.currentTarget.style.transform = 'none' }}
          onTouchStart={(e) => { e.currentTarget.style.transform = 'translateY(2px)' }}
          onTouchEnd={(e)   => { e.currentTarget.style.transform = 'none' }}
        >
          ↺ Try Again
        </button>

        {/* HOME */}
        <button
          id="gameover-home-button"
          onClick={onHome}
          className="w-full flex items-center justify-center rounded-2xl font-semibold"
          style={{
            height: 44,
            fontSize: 13,
            letterSpacing: '0.06em',
            color: '#fca5a5',
            background: 'rgba(255,255,255,0.07)',
            border: '1.5px solid rgba(252,165,165,0.30)',
            transition: 'filter 0.1s, background 0.1s, color 0.1s',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.14)'; e.currentTarget.style.color = '#ffffff' }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.07)'; e.currentTarget.style.color = '#fca5a5' }}
        >
          ← Back to Home
        </button>
      </div>
    </div>
  )
}

// ─── Win overlay ────────────────────────────────────────────────────────────

function StarDisplay({ stars }: { stars: number }) {
  return (
    <div className="flex items-center justify-center gap-2" style={{ fontSize: 38, lineHeight: 1 }}>
      {[1, 2, 3].map((n) => (
        <span
          key={n}
          style={{
            filter: n <= stars
              ? 'drop-shadow(0 0 10px rgba(251,191,36,0.9))'
              : 'grayscale(1) opacity(0.25)',
            transform: n <= stars ? 'scale(1.1)' : 'scale(0.9)',
            transition: 'filter 0.3s, transform 0.3s',
            display: 'inline-block',
          }}
        >
          ⭐
        </span>
      ))}
    </div>
  )
}

function WinOverlay({
  nextLabel,
  onNext,
  onRetry,
  onHome,
}: {
  nextLabel: string | null
  onNext: () => void
  onRetry: () => void
  onHome:  () => void
}) {
  const stars    = useGameStore((s) => s.starsEarned)
  const crowd    = useGameStore((s) => s.remainingCrowdAfterBoss)
  const bossHp   = useGameStore((s) => s.bossHealth)
  const multiplier = useGameStore((s) => s.finishMultiplier)
  const coinsEarned = useGameStore((s) => s.coinsEarned)
  const score = useGameStore((s) => s.score)
  const bonusPoints = useGameStore((s) => s.bonusPoints)

  const starMsg =
    stars >= 3 ? 'Perfect run! 🔥' :
    stars >= 2 ? 'Great job! 👏' :
                 'You made it! 🎉'

  return (
    <div
      className="absolute inset-0 flex flex-col items-center justify-center"
      style={{ background: 'rgba(2,6,23,0.88)', backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)' }}
    >
      <div
        className="flex flex-col items-center gap-4 rounded-3xl modal-enter"
        style={{
          padding: '28px 36px',
          background: 'linear-gradient(160deg, rgba(4,47,104,0.97), rgba(29,78,216,0.92))',
          border: '2px solid rgba(96,165,250,0.55)',
          boxShadow: '0 24px 60px rgba(0,0,0,0.70), 0 0 40px rgba(96,165,250,0.20), inset 0 1px 0 rgba(255,255,255,0.09)',
          minWidth: 260,
          maxWidth: 320,
          width: '88%',
        }}
      >
        {/* Icon + title */}
        <div className="text-center">
          <div style={{ fontSize: 48, lineHeight: 1, marginBottom: 8 }}>🏆</div>
          <h2
            className="text-white font-black"
            style={{
              fontSize: 28,
              letterSpacing: '0.10em',
              textShadow: '0 0 24px rgba(96,165,250,0.8)',
              lineHeight: 1.1,
            }}
          >
            YOU WIN!
          </h2>
          <p style={{ fontSize: 13, color: '#93c5fd', fontWeight: 600, marginTop: 6 }}>{starMsg}</p>
        </div>

        {/* Stars */}
        <StarDisplay stars={stars} />

        {/* Stats grid */}
        <div
          className="w-full grid rounded-2xl overflow-hidden"
          style={{
            gridTemplateColumns: '1fr 1fr',
            gap: 2,
            background: 'rgba(0,0,0,0.25)',
            border: '1px solid rgba(96,165,250,0.18)',
          }}
        >
          {([
            ['Crowd left',  crowd.toString(), '#4ade80'],
            ['Boss slain',  bossHp.toString(), '#f472b6'],
            ['Multiplier', `x${multiplier}`, '#fbbf24'],
            ['Coins', `+${coinsEarned}`, '#fde047'],
            ['Bonus points', `+${bonusPoints.toLocaleString()}`, '#60a5fa'],
            ['Score', score.toLocaleString(), '#a78bfa'],
          ] as [string, string, string][]).map(([label, value, col]) => (
            <div
              key={label}
              className="flex flex-col items-center justify-center"
              style={{ padding: '10px 6px', background: 'rgba(255,255,255,0.04)' }}
            >
              <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', color: 'rgba(186,230,253,0.65)', textTransform: 'uppercase', marginBottom: 3 }}>
                {label}
              </span>
              <span style={{ fontSize: 24, fontWeight: 900, color: col, letterSpacing: '-0.02em', lineHeight: 1, textShadow: `0 0 12px ${col}88` }}>
                {value}
              </span>
            </div>
          ))}
        </div>

        {nextLabel && <button
          id="win-next-button"
          onClick={() => { audioManager.playButtonClick(); onNext() }}
          className="w-full flex items-center justify-center gap-2 rounded-2xl font-black text-white"
          style={{
            height: 56,
            fontSize: 16,
            letterSpacing: '0.08em',
            background: 'linear-gradient(180deg,#facc15 0%,#f59e0b 48%,#d97706 100%)',
            border: '2px solid #fef08a',
            boxShadow: '0 5px 0 #78350f, 0 8px 24px rgba(245,158,11,0.48)',
          }}
        >
          NEXT · {nextLabel} →
        </button>}

        {/* Play again */}
        <button
          id="win-retry-button"
          onClick={() => { audioManager.playButtonClick(); onRetry() }}
          className="w-full flex items-center justify-center gap-2 rounded-2xl font-black text-white"
          style={{
            height: nextLabel ? 44 : 54,
            fontSize: nextLabel ? 13 : 16,
            letterSpacing: '0.10em',
            background: 'linear-gradient(180deg, #4ade80 0%, #22c55e 35%, #16a34a 70%, #15803d 100%)',
            border: '2px solid #86efac',
            boxShadow: '0 5px 0 #14532d, 0 8px 24px rgba(22,163,74,0.45)',
            transition: 'transform 0.1s, filter 0.1s',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.filter = 'brightness(1.08)' }}
          onMouseLeave={(e) => { e.currentTarget.style.filter = 'brightness(1)' }}
          onMouseDown={(e)  => { e.currentTarget.style.transform = 'translateY(2px)' }}
          onMouseUp={(e)    => { e.currentTarget.style.transform = 'none' }}
          onTouchStart={(e) => { e.currentTarget.style.transform = 'translateY(2px)' }}
          onTouchEnd={(e)   => { e.currentTarget.style.transform = 'none' }}
        >
          ↺ Replay This Level
        </button>

        {/* Home */}
        <button
          id="win-home-button"
          onClick={() => { audioManager.playButtonClick(); onHome() }}
          className="w-full flex items-center justify-center rounded-2xl font-semibold"
          style={{
            height: 44,
            fontSize: 13,
            letterSpacing: '0.06em',
            color: '#93c5fd',
            background: 'rgba(255,255,255,0.07)',
            border: '1.5px solid rgba(96,165,250,0.35)',
            transition: 'filter 0.1s, background 0.1s, color 0.1s',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.14)'; e.currentTarget.style.color = '#ffffff' }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.07)'; e.currentTarget.style.color = '#93c5fd' }}
        >
          ← Back to Home
        </button>
      </div>
    </div>
  )
}

// ─── GameScreen – root export ───────────────────────────────────────────────

export function GameScreen() {
  const phase      = useGameStore((s) => s.phase)
  const difficulty = useGameStore((s) => s.difficulty)
  const selectedLevel = useGameStore((s) => s.selectedLevel)
  const setSelectedLevel = useGameStore((s) => s.setSelectedLevel)
  const setDifficulty = useGameStore((s) => s.setDifficulty)
  const crowdSize  = useGameStore((s) => s.crowdSize)
  const isPaused   = useGameStore((s) => s.isPaused)
  const setPaused  = useGameStore((s) => s.setPaused)
  const setPhase   = useGameStore((s) => s.setPhase)
  const resetGame  = useGameStore((s) => s.resetGame)
  const runStage = useGameStore((s) => s.runStage)
  const bossHealth = useGameStore((s) => s.bossHealth)
  const bossRemainingHealth = useGameStore((s) => s.bossRemainingHealth)
  const finishMultiplier = useGameStore((s) => s.finishMultiplier)
  const score = useGameStore((s) => s.score)
  const clientRunId = useGameStore((s) => s.clientRunId)

  // Game is frozen when paused, game over, OR win
  const isFrozen = isPaused || phase === 'gameover' || phase === 'win'

  const [displayDist, setDisplayDist] = useState(0)
  const lastDistRef = useRef(0)
  const submittedRunRef = useRef<string | null>(null)


  // Escape toggles pause (not during win or gameover)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && phase !== 'gameover' && phase !== 'win') setPaused(!isPaused)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isPaused, phase, setPaused])

  const handleDistanceUpdate = useCallback((dist: number) => {
    const floored = Math.floor(dist)
    if (floored !== lastDistRef.current) {
      lastDistRef.current = floored
      setDisplayDist(floored)
      useGameStore.getState().setRunDistance(floored)
    }
  }, [])

  useEffect(() => {
    if ((phase !== 'win' && phase !== 'gameover') || !clientRunId) return
    if (submittedRunRef.current === clientRunId) return
    submittedRunRef.current = clientRunId
    void submitCompletedRun()
  }, [clientRunId, phase])

  const handlePause  = () => setPaused(true)
  const handleResume = () => setPaused(false)
  const handleHome   = () => { setPaused(false); setPhase('home') }
  const handleRetry  = () => { resetGame() }  // App's gameKey key forces remount
  const nextLevel = getNextLevelSelection(difficulty, selectedLevel)
  const handleNextLevel = () => {
    if (!nextLevel) return
    setDifficulty(nextLevel.difficulty)
    setSelectedLevel(nextLevel.level)
    void saveSelectedDifficulty(nextLevel.difficulty, nextLevel.level)
    resetGame()
  }

  // Difficulty accent colours (matching home screen diff buttons)
  const diffAccent: Record<string, string> = {
    easy:   '#4ade80',
    medium: '#34d399',
    hard:   '#fb923c',
    expert: '#c084fc',
  }
  const accent = diffAccent[difficulty] ?? '#60a5fa'

  return (
    /*
      Outer wrapper matches the home screen: dark navy radial background
      on desktop, phone shell centred at 9:16.
    */
    <div
      className="w-full h-full flex items-center justify-center"
      style={{ background: 'radial-gradient(ellipse at 50% 40%, #0c1a40 0%, #020617 70%)' }}
    >
      {/* ── Phone shell: 9:16 portrait container ── */}
      <div className="phone-shell" style={{ containerType: 'inline-size' }}>

        {/* 3D canvas fills the entire shell */}
        <div className="absolute inset-0">
          <GameScene
            difficulty={difficulty}
            level={selectedLevel}
            isPaused={isFrozen}
            onDistanceUpdate={handleDistanceUpdate}
          />
        </div>

        {/*
          Bottom vignette only — keeps sky visible at top while
          grounding the road at the bottom of the frame.
        */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              'linear-gradient(180deg,' +
              'rgba(0,0,0,0.00)  0%,' +
              'rgba(0,0,0,0.00) 60%,' +
              'rgba(0,4,16,0.55) 85%,' +
              'rgba(0,2,10,0.80) 100%)',
          }}
        />

        {/* ── HUD overlay (pointer-events-none by default) ── */}
        <div className="absolute inset-0 pointer-events-none flex flex-col safe-top safe-bottom">

          {/* ── TOP BAR ── */}
          <div
            className="flex items-center justify-between"
            style={{ padding: '12px 14px 0' }}
          >
            {/* Crowd counter — most important, left-aligned */}
            <div className="pointer-events-auto">
              <CrowdCounter count={crowdSize} />
            </div>

            {/* Distance — centre */}
            <DistancePill meters={displayDist} />

            {/* Pause button — right */}
            <div className="pointer-events-auto">
              <IconButton id="pause-button" onClick={handlePause} ariaLabel="Pause">
                <svg width="13" height="15" viewBox="0 0 13 15" fill="white">
                  <rect x="1"  y="0" width="4" height="15" rx="2" />
                  <rect x="8"  y="0" width="4" height="15" rx="2" />
                </svg>
              </IconButton>
            </div>
          </div>

          {/* ── DIFFICULTY BADGE ── */}
          <div className="flex justify-center" style={{ marginTop: 6 }}>
            <div
              className="px-3 py-0.5 rounded-full font-bold"
              style={{
                fontSize: 9,
                letterSpacing: '0.14em',
                color: accent,
                background: `${accent}1a`,
                border: `1px solid ${accent}44`,
                backdropFilter: 'blur(8px)',
                textTransform: 'uppercase',
              }}
            >
              {difficulty} · level {selectedLevel}
            </div>
          </div>

          {runStage === 'boss' && (
            <div className="flex justify-center" style={{ marginTop: 8 }}>
              <div style={{ width: '62%', padding: 6, borderRadius: 12, background: 'rgba(30,10,60,0.82)', border: '1px solid rgba(216,180,254,0.55)' }}>
                <div className="flex justify-between" style={{ color: '#f5d0fe', fontSize: 9, fontWeight: 900, marginBottom: 4 }}>
                  <span>BOSS</span><span>{bossRemainingHealth} / {bossHealth}</span>
                </div>
                <div style={{ height: 7, borderRadius: 99, overflow: 'hidden', background: 'rgba(255,255,255,0.12)' }}>
                  <div style={{ width: `${bossHealth > 0 ? bossRemainingHealth / bossHealth * 100 : 0}%`, height: '100%', background: 'linear-gradient(90deg,#ef4444,#c026d3)', transition: 'width 0.1s linear' }} />
                </div>
              </div>
            </div>
          )}

          {runStage === 'bonus' && (
            <div className="flex justify-center" style={{ marginTop: 8 }}>
              <div style={{ padding: '5px 14px', borderRadius: 99, color: '#fef08a', background: 'rgba(120,53,15,0.78)', border: '1px solid rgba(251,191,36,0.6)', fontWeight: 900, fontSize: 12 }}>
                BONUS RUN · x{finishMultiplier}
              </div>
            </div>
          )}

          {runStage === 'conversion' && (
            <div className="flex justify-center" style={{ marginTop: 8 }}>
              <div style={{ padding: '6px 16px', borderRadius: 99, color: '#fef08a', background: 'rgba(88,28,135,0.84)', border: '1px solid rgba(250,204,21,0.72)', fontWeight: 900, fontSize: 13 }}>
                x{finishMultiplier} · {crowdSize} CROWD LEFT
              </div>
            </div>
          )}

          {/* Spacer — 3D scene fills here */}
          <div style={{ flex: 1 }} />

        </div>

        {/* ── PAUSE OVERLAY (only while paused, not during game over or win) ── */}
        {isPaused && phase !== 'gameover' && phase !== 'win' && (
          <PauseOverlay onResume={handleResume} onRestart={handleRetry} onHome={handleHome} />
        )}

        {/* ── GAME OVER OVERLAY ── */}
        {phase === 'gameover' && (
          <GameOverOverlay
            distance={displayDist}
            score={score}
            onRetry={handleRetry}
            onHome={() => setPhase('home')}
          />
        )}

        {/* ── WIN OVERLAY ── */}
        {phase === 'win' && (
          <WinOverlay
            nextLabel={nextLevel ? `${nextLevel.difficulty.toUpperCase()} ${nextLevel.level}` : null}
            onNext={handleNextLevel}
            onRetry={handleRetry}
            onHome={() => setPhase('home')}
          />
        )}

      </div>
    </div>
  )
}
