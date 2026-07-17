/**
 * HomeScreen – Production-quality mobile-first portrait layout for Math Rush 3D.
 *
 * ┌─────────────────────┐
 * │ 🏆 12,450  💰 5,230  │  top bar – pill chips
 * │                     │
 * │      M A T H        │  title block
 * │      R U S H        │
 * │        3D           │
 * │  ❯ tagline text ❮   │  subtitle
 * │                     │
 * │  [+8] -4 +12  [×2]  │  game preview
 * │                     │
 * │   ▶   P L A Y       │  large CTA – glows
 * │                     │
 * │  EASY MED HARD EXP  │  difficulty 4-col
 * │                     │
 * │ ⚙️ OPTIONS  👕 SKINS  │  action pills
 * │                     │
 * │ 👑 LEADERBOARD  ▾   │  collapsible card
 * │  🥇 MathMaster 23k  │
 * │  🥈 NumberNinja 18k │
 * │  ...                │
 * │                     │
 * │ 🎁 tip text         │  info bar
 * └─────────────────────┘
 */
import { useEffect, useState, useRef, type CSSProperties } from 'react'
import { HomeBackground }  from '../components/HomeBackground'
import { OptionsModal }    from '../components/ui/OptionsModal'
import { SkinsModal }      from '../components/ui/SkinsModal'
import { StatsModal }      from '../components/ui/StatsModal'
import { useGameStore, type Difficulty } from '../store/useGameStore'
import { audioManager }   from '../utils/audioManager'
import { fetchLeaderboard, saveSelectedDifficulty } from '../services/api'

// ─────────────────────────────────────────────────────────────────────────────
// Design tokens — single source of truth
// ─────────────────────────────────────────────────────────────────────────────

/** Shared glass-card surface used by top-bar chips */
const GLASS: CSSProperties = {
  background: 'linear-gradient(155deg, rgba(15,23,42,0.88) 0%, rgba(30,41,89,0.78) 100%)',
  border: '1px solid rgba(125,211,252,0.30)',
  boxShadow: '0 2px 12px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.10)',
  backdropFilter: 'blur(14px)',
}

// ─────────────────────────────────────────────────────────────────────────────
// Static data
// ─────────────────────────────────────────────────────────────────────────────

interface DiffConfig {
  id: Difficulty
  label: string
  sub: string
  stars: number
  gradFrom: string
  gradTo: string
  glow: string
  border: string
  bottom: string
}

const DIFFS: DiffConfig[] = [
  {
    id: 'easy',   label: 'EASY',   sub: 'Chill',
    stars: 1, gradFrom: '#4ade80', gradTo: '#16a34a',
    glow: 'rgba(34,197,94,0.65)',  border: '#86efac', bottom: '#14532d',
  },
  {
    id: 'medium', label: 'MED',    sub: 'Normal',
    stars: 2, gradFrom: '#34d399', gradTo: '#059669',
    glow: 'rgba(16,185,129,0.65)', border: '#6ee7b7', bottom: '#064e3b',
  },
  {
    id: 'hard',   label: 'HARD',   sub: 'Tough',
    stars: 3, gradFrom: '#fb923c', gradTo: '#ea580c',
    glow: 'rgba(249,115,22,0.75)', border: '#fdba74', bottom: '#7c2d12',
  },
  {
    id: 'expert', label: 'EXPRT',  sub: 'Master',
    stars: 4, gradFrom: '#c084fc', gradTo: '#7c3aed',
    glow: 'rgba(124,58,237,0.75)', border: '#d8b4fe', bottom: '#3b0764',
  },
]

interface LeaderboardRow { rank: number; name: string; score: number; bg: string }

const RANK_MEDAL: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' }

const CROWD_COLORS = [
  '#8b5cf6','#3b82f6','#10b981','#f59e0b','#ec4899',
  '#06b6d4','#84cc16','#ef4444','#a855f7','#22d3ee',
  '#f97316','#14b8a6',
]

// ─────────────────────────────────────────────────────────────────────────────
// CoinCounter – top-right chip
// ─────────────────────────────────────────────────────────────────────────────

function CoinCounter() {
  const coins    = useGameStore((s) => s.coins)

  return (
    <div
      className="flex items-center gap-2 px-3 py-1.5 rounded-full select-none"
      style={{
        ...GLASS,
        border: '1.5px solid rgba(251,191,36,0.55)',
        boxShadow: '0 2px 14px rgba(0,0,0,0.40), 0 0 0 1px rgba(251,191,36,0.12), inset 0 1px 0 rgba(255,255,255,0.10)',
      }}
    >
      {/* Coin disc */}
      <div
        className="w-[22px] h-[22px] rounded-full flex items-center justify-center font-black flex-shrink-0"
        style={{
          fontSize: 10,
          background: 'radial-gradient(circle at 35% 28%, #fef9c3, #fbbf24 50%, #d97706)',
          boxShadow: '0 1px 0 #92400e, 0 2px 8px rgba(217,119,6,0.55), inset 0 1px 0 rgba(255,255,255,0.55)',
          color: '#78350f',
          textShadow: '0 1px 0 rgba(255,255,255,0.4)',
        }}
      >
        $
      </div>
      <span className="text-white font-bold tabular-nums" style={{ fontSize: 14, letterSpacing: '0.01em' }}>
        {coins.toLocaleString()}
      </span>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// BestScorePanel – top-left chip
// ─────────────────────────────────────────────────────────────────────────────

function BestScorePanel({ score }: { score: number }) {
  return (
    <div
      className="flex items-center gap-2 px-3 py-1.5 rounded-full select-none"
      style={GLASS}
    >
      <span
        className="flex-shrink-0 leading-none"
        style={{ fontSize: 16, filter: 'drop-shadow(0 1px 3px rgba(245,158,11,0.6))' }}
      >
        🏆
      </span>
      <div className="flex flex-col leading-none">
        <span
          className="font-bold tracking-widest uppercase"
          style={{ fontSize: 8, color: '#7dd3fc', letterSpacing: '0.12em' }}
        >
          Best
        </span>
        <span className="text-white font-black tabular-nums" style={{ fontSize: 14, letterSpacing: '-0.01em' }}>
          {score.toLocaleString()}
        </span>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// TitleLogo – stacked MATH / RUSH / 3D with layered depth
// ─────────────────────────────────────────────────────────────────────────────

function TitleLogo() {
  // Layered 3D shadow: each offset builds depth without hardware GPU cost
  const shadow3d =
    '0 1px 0 #1e3a8a,' +
    '0 2px 0 #1e40af,' +
    '0 3px 0 #1e3a8a,' +
    '0 4px 0 #172554,' +
    '0 5px 0 #0f172a,' +
    '0 6px 18px rgba(0,0,0,0.55),' +
    '0 0 40px rgba(186,230,253,0.35)'

  const goldenShadow =
    '0 1px 0 #92400e,' +
    '0 2px 0 #78350f,' +
    '0 3px 0 #451a03,' +
    '0 4px 10px rgba(0,0,0,0.5),' +
    '0 0 28px rgba(251,191,36,0.55)'

  return (
    <div className="text-center select-none" style={{ lineHeight: 1 }}>
      {/* White stroke + shadow creates readable 3D depth on any background */}
      {(['MATH', 'RUSH'] as const).map((word) => (
        <div
          key={word}
          style={{
            fontFamily: "'Fredoka', 'Nunito', sans-serif",
            fontWeight: 700,
            // Use px so sizing is relative to the phone shell width, not viewport
            fontSize: 'clamp(2.8rem, 17cqw, 4.2rem)',
            color: '#f0f9ff',
            textShadow: shadow3d,
            WebkitTextStroke: '1.5px rgba(30,58,138,0.8)',
            letterSpacing: '-0.025em',
            lineHeight: 0.90,
          }}
        >
          {word}
        </div>
      ))}

      {/* 3D badge row */}
      <div className="flex items-center justify-center gap-2 mt-1">
        {/* Left line */}
        <div style={{ flex: 1, height: 1, background: 'linear-gradient(to right, transparent, rgba(252,211,77,0.55))' }} />
        <div
          style={{
            fontFamily: "'Fredoka', 'Nunito', sans-serif",
            fontWeight: 700,
            fontSize: 'clamp(1.4rem, 8cqw, 2rem)',
            color: '#fcd34d',
            textShadow: goldenShadow,
            WebkitTextStroke: '1px #78350f',
            letterSpacing: '0.22em',
            lineHeight: 1,
          }}
        >
          3D
        </div>
        {/* Right line */}
        <div style={{ flex: 1, height: 1, background: 'linear-gradient(to left, transparent, rgba(252,211,77,0.55))' }} />
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// GamePreview – CSS illustration of crowd and math gates
// ─────────────────────────────────────────────────────────────────────────────

function CrowdFigure({ color, scale = 1 }: { color: string; scale?: number }) {
  return (
    <div
      className="flex flex-col items-center"
      style={{ transform: `scale(${scale})`, transformOrigin: 'bottom center' }}
    >
      {/* Head */}
      <div
        style={{
          width: 9, height: 9, borderRadius: '50%',
          background: `radial-gradient(circle at 35% 30%, ${color}ff, ${color}bb)`,
          boxShadow: `0 1px 4px rgba(0,0,0,0.45)`,
        }}
      />
      {/* Body */}
      <div
        style={{
          width: 12, height: 15, borderRadius: '40%',
          background: `radial-gradient(circle at 35% 25%, ${color}dd, ${color}88)`,
          boxShadow: `0 1px 4px rgba(0,0,0,0.35)`,
          marginTop: -2,
        }}
      />
    </div>
  )
}

const GATE_PANEL: CSSProperties = {
  background: 'linear-gradient(160deg, rgba(37,99,235,0.48), rgba(30,64,175,0.60))',
  backdropFilter: 'blur(16px)',
  border: '1.5px solid rgba(147,197,253,0.45)',
  boxShadow: '0 4px 20px rgba(59,130,246,0.3), inset 0 1px 0 rgba(255,255,255,0.16)',
  borderRadius: 16,
}

function GateChip({ label, accent }: { label: string; accent: string }) {
  return (
    <div
      className="absolute top-2 px-2 py-0.5 rounded-full text-white font-bold"
      style={{
        fontSize: 9,
        background: `${accent}33`,
        border: `1px solid ${accent}55`,
        letterSpacing: '0.04em',
      }}
    >
      {label}
    </div>
  )
}

function GamePreview() {
  const scales = [1.1,0.9,1.05,0.95,1.0,1.0,0.9,1.05,0.95,1.0,0.9,1.05]

  return (
    <div className="flex gap-2 items-stretch" style={{ height: 100 }}>

      {/* Left gate */}
      <div
        className="flex-1 flex flex-col items-center justify-center relative overflow-hidden"
        style={GATE_PANEL}
      >
        <GateChip label="+2 pts" accent="#60a5fa" />
        <span
          className="font-black text-white"
          style={{ fontSize: '1.85rem', textShadow: '0 0 20px #93c5fd, 0 2px 6px rgba(0,0,0,0.55)', letterSpacing: '-0.02em' }}
        >
          +8
        </span>
      </div>

      {/* Centre crowd */}
      <div className="flex flex-col justify-end items-center gap-1" style={{ width: '38%' }}>
        <div className="flex gap-1 w-full">
          {[{ val: '‒4', from: '#f87171', to: '#dc2626', glow: 'rgba(239,68,68,0.5)' },
            { val: '+12', from: '#4ade80', to: '#16a34a', glow: 'rgba(74,222,128,0.5)' }]
            .map(({ val, from, to, glow }) => (
              <div
                key={val}
                className="flex-1 flex items-center justify-center rounded-xl font-black text-white"
                style={{
                  height: 26,
                  fontSize: 12,
                  background: `linear-gradient(135deg, ${from}, ${to})`,
                  boxShadow: `0 0 10px ${glow}, inset 0 1px 0 rgba(255,255,255,0.2)`,
                  letterSpacing: '-0.01em',
                }}
              >
                {val}
              </div>
          ))}
        </div>
        <div className="flex flex-wrap justify-center items-end" style={{ gap: 1 }}>
          {CROWD_COLORS.map((c, i) => (
            <CrowdFigure key={i} color={c} scale={scales[i]} />
          ))}
        </div>
      </div>

      {/* Right gate */}
      <div
        className="flex-1 flex flex-col items-center justify-center relative overflow-hidden"
        style={GATE_PANEL}
      >
        <GateChip label="+5 pts" accent="#60a5fa" />
        <span
          className="font-black text-white"
          style={{ fontSize: '1.85rem', textShadow: '0 0 20px #93c5fd, 0 2px 6px rgba(0,0,0,0.55)', letterSpacing: '-0.02em' }}
        >
          ×2
        </span>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// PlayButton – main CTA
// ─────────────────────────────────────────────────────────────────────────────

function PlayButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      id="play-button"
      onClick={onClick}
      className="play-glow w-full flex items-center justify-center gap-3 font-black text-white rounded-full select-none"
      style={{
        fontSize: '1.6rem',
        letterSpacing: '0.16em',
        textShadow: '0 2px 6px rgba(0,0,0,0.35)',
        background: 'linear-gradient(180deg, #4ade80 0%, #22c55e 30%, #16a34a 65%, #15803d 100%)',
        border: '2px solid #86efac',
        paddingTop: 15,
        paddingBottom: 15,
        // Transition for hover/press — glow-pulse handles the box-shadow animation
        transition: 'transform 0.12s cubic-bezier(0.34,1.56,0.64,1), filter 0.12s ease',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.filter = 'brightness(1.08)' }}
      onMouseLeave={(e) => { e.currentTarget.style.filter = 'brightness(1)' }}
      onMouseDown={(e)  => { e.currentTarget.style.transform = 'scale(0.97)' }}
      onMouseUp={(e)    => { e.currentTarget.style.transform = 'scale(1)' }}
      onTouchStart={(e) => { e.currentTarget.style.transform = 'scale(0.96)' }}
      onTouchEnd={(e)   => { e.currentTarget.style.transform = 'scale(1)' }}
    >
      <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
        <path d="M8 5v14l11-7z" />
      </svg>
      PLAY
    </button>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// DiffBtn – difficulty selector
// ─────────────────────────────────────────────────────────────────────────────

function DiffBtn({ diff, active, onClick }: { diff: DiffConfig; active: boolean; onClick: () => void }) {
  return (
    <button
      id={`diff-${diff.id}`}
      onClick={onClick}
      className="flex-1 flex flex-col items-center justify-center rounded-2xl"
      style={{
        height: 68,
        background: active
          ? `linear-gradient(180deg, ${diff.gradFrom} 0%, ${diff.gradTo} 100%)`
          : `linear-gradient(180deg, ${diff.gradFrom}bb 0%, ${diff.gradTo}99 100%)`,
        border: `2px solid ${active ? diff.border : diff.border + '44'}`,
        boxShadow: active
          ? `0 5px 0 ${diff.bottom}, 0 9px 22px ${diff.glow}, inset 0 1px 0 rgba(255,255,255,0.32)`
          : `0 2px 0 ${diff.bottom}66, inset 0 1px 0 rgba(255,255,255,0.12)`,
        opacity: active ? 1 : 0.72,
        transform: active ? 'translateY(-3px)' : 'translateY(0)',
        transition: 'all 0.15s cubic-bezier(0.34,1.4,0.64,1)',
        padding: '6px 3px 4px',
      }}
    >
      {/* Stars row */}
      <div style={{ fontSize: 9, color: '#fef08a', letterSpacing: 2, lineHeight: 1, marginBottom: 3 }}>
        {'★'.repeat(diff.stars)}
        <span style={{ opacity: 0.22 }}>{'★'.repeat(4 - diff.stars)}</span>
      </div>
      {/* Label */}
      <div
        className="text-white font-black leading-none"
        style={{ fontSize: 11.5, textShadow: '0 1px 4px rgba(0,0,0,0.5)', letterSpacing: '0.04em' }}
      >
        {diff.label}
      </div>
      {/* Sub */}
      <div className="font-semibold leading-none mt-1" style={{ fontSize: 8, color: 'rgba(255,255,255,0.78)' }}>
        {diff.sub}
      </div>
    </button>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// ActionPill – wide horizontal pill for Options / Skins
// ─────────────────────────────────────────────────────────────────────────────

function ActionPill({ icon, label, onClick, id }: {
  icon: string; label: string; onClick: () => void; id: string
}) {
  return (
    <button
      id={id}
      onClick={onClick}
      className="flex-1 flex items-center justify-center gap-2 rounded-2xl select-none"
      style={{
        height: 50,
        background: 'linear-gradient(180deg, #7c3aed 0%, #6d28d9 55%, #5b21b6 100%)',
        border: '1.5px solid rgba(167,139,250,0.65)',
        boxShadow: '0 4px 0 #2e1065, 0 6px 18px rgba(109,40,217,0.40), inset 0 1px 0 rgba(255,255,255,0.20)',
        transition: 'transform 0.12s cubic-bezier(0.34,1.4,0.64,1), filter 0.12s ease',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.filter = 'brightness(1.12)' }}
      onMouseLeave={(e) => { e.currentTarget.style.filter = 'brightness(1)' }}
      onMouseDown={(e)  => { e.currentTarget.style.transform = 'translateY(2px)'; (e.currentTarget.style as CSSStyleDeclaration & { boxShadow: string }).boxShadow = '0 2px 0 #2e1065, 0 3px 10px rgba(109,40,217,0.35), inset 0 1px 0 rgba(255,255,255,0.15)' }}
      onMouseUp={(e)    => { e.currentTarget.style.transform = 'translateY(0)'; (e.currentTarget.style as CSSStyleDeclaration & { boxShadow: string }).boxShadow = '0 4px 0 #2e1065, 0 6px 18px rgba(109,40,217,0.40), inset 0 1px 0 rgba(255,255,255,0.20)' }}
      onTouchStart={(e) => { e.currentTarget.style.transform = 'translateY(2px)' }}
      onTouchEnd={(e)   => { e.currentTarget.style.transform = 'translateY(0)' }}
    >
      <span style={{ fontSize: 19, lineHeight: 1 }}>{icon}</span>
      <span
        className="text-white font-black tracking-wide"
        style={{ fontSize: 13, textShadow: '0 1px 3px rgba(0,0,0,0.45)', letterSpacing: '0.06em' }}
      >
        {label}
      </span>
    </button>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Leaderboard – full-width collapsible card
// ─────────────────────────────────────────────────────────────────────────────

function Leaderboard() {
  const [open, setOpen] = useState(true)
  const bodyRef = useRef<HTMLDivElement>(null)
  const backendStatus = useGameStore((state) => state.backendStatus)
  const [entries, setEntries] = useState<LeaderboardRow[]>([])

  useEffect(() => {
    if (backendStatus !== 'online') return
    let cancelled = false
    void fetchLeaderboard().then((rows) => {
      if (cancelled) return
      setEntries(rows.slice(0, 5).map((row) => ({
        rank: row.rank,
        name: row.displayName,
        score: row.score,
        bg: ['#f59e0b', '#818cf8', '#34d399', '#fb923c', '#f472b6'][row.rank - 1] ?? '#60a5fa',
      })))
    }).catch(() => null)
    return () => { cancelled = true }
  }, [backendStatus])

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{
        background: 'linear-gradient(180deg, rgba(23,55,135,0.97) 0%, rgba(23,37,84,0.99) 100%)',
        border: '1.5px solid rgba(96,165,250,0.45)',
        boxShadow: '0 6px 28px rgba(0,0,0,0.50), inset 0 1px 0 rgba(255,255,255,0.06)',
      }}
    >
      {/* ── Tappable header ── */}
      <button
        id="leaderboard-toggle"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 select-none"
        style={{
          background: 'linear-gradient(135deg, rgba(37,99,235,0.92) 0%, rgba(29,78,216,0.97) 100%)',
          borderBottom: open ? '1px solid rgba(96,165,250,0.25)' : 'none',
          transition: 'filter 0.12s ease',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.filter = 'brightness(1.08)' }}
        onMouseLeave={(e) => { e.currentTarget.style.filter = 'brightness(1)' }}
      >
        {/* Left: crown + title */}
        <div className="flex items-center gap-2.5">
          <span style={{ fontSize: 17, filter: 'drop-shadow(0 1px 4px rgba(251,191,36,0.7))' }}>👑</span>
          <div>
            <div className="text-white font-black tracking-widest" style={{ fontSize: 12, letterSpacing: '0.10em' }}>
              LEADERBOARD
            </div>
            <div style={{ fontSize: 9, color: '#93c5fd', fontWeight: 600, letterSpacing: '0.04em' }}>
              Global rankings
            </div>
          </div>
        </div>

        {/* Right: badge + chevron */}
        <div className="flex items-center gap-2">
          <div
            className="px-2 py-0.5 rounded-full font-bold text-sky-200"
            style={{ fontSize: 9, background: 'rgba(148,163,184,0.14)', border: '1px solid rgba(148,163,184,0.2)', letterSpacing: '0.04em' }}
          >
            TOP 5
          </div>
          <svg
            width="16" height="16" viewBox="0 0 24 24" fill="white"
            style={{
              opacity: 0.70,
              transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
              transition: 'transform 0.25s cubic-bezier(0.4,0,0.2,1)',
            }}
          >
            <path d="M7 10l5 5 5-5z" />
          </svg>
        </div>
      </button>

      {/* ── Collapsible body ── */}
      {open && (
        <div ref={bodyRef} className="leader-entries-open">

          {/* Entries list */}
          <div className="px-3 pt-2 pb-3" style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {entries.map((entry, i) => (
              <div
                key={entry.rank}
                className="flex items-center gap-3 px-2.5 py-2 rounded-xl"
                style={{
                  background: i === 0
                    ? 'linear-gradient(135deg, rgba(251,191,36,0.10), rgba(251,191,36,0.05))'
                    : i % 2 === 0 ? 'rgba(255,255,255,0.025)' : 'transparent',
                  border: i === 0 ? '1px solid rgba(251,191,36,0.18)' : '1px solid transparent',
                }}
              >
                {/* Medal / rank */}
                <div className="w-7 flex-shrink-0 flex items-center justify-center" style={{ fontSize: entry.rank <= 3 ? 18 : 12 }}>
                  {RANK_MEDAL[entry.rank] ?? (
                    <span style={{ fontWeight: 900, color: '#64748b' }}>{entry.rank}</span>
                  )}
                </div>

                {/* Avatar */}
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center font-black text-white flex-shrink-0"
                  style={{
                    fontSize: 12,
                    background: `radial-gradient(circle at 38% 30%, ${entry.bg}dd, ${entry.bg}99)`,
                    boxShadow: `0 2px 8px rgba(0,0,0,0.40), 0 0 0 1.5px ${entry.bg}66`,
                  }}
                >
                  {entry.name.charAt(0)}
                </div>

                {/* Name */}
                <span className="flex-1 text-white font-semibold truncate min-w-0" style={{ fontSize: 13 }}>
                  {entry.name}
                </span>

                {/* Score */}
                <div className="flex-shrink-0 text-right">
                  <div
                    className="font-black tabular-nums"
                    style={{ fontSize: 14, color: i === 0 ? '#fbbf24' : '#93c5fd', letterSpacing: '-0.01em' }}
                  >
                    {entry.score.toLocaleString()}
                  </div>
                  <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.30)', fontWeight: 600, letterSpacing: '0.06em' }}>
                    PTS
                  </div>
                </div>
              </div>
            ))}
            {entries.length === 0 && (
              <div className="text-center py-4" style={{ color: '#93c5fd', fontSize: 11 }}>
                {backendStatus === 'connecting' ? 'Loading rankings…' : 'Complete a run to enter the leaderboard.'}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// GiftInfoBox – info/helper bar
// ─────────────────────────────────────────────────────────────────────────────

function GiftInfoBox() {
  return (
    <div
      className="rounded-2xl px-3.5 py-2.5 flex items-center gap-3"
      style={{
        background: 'linear-gradient(135deg, rgba(23,55,135,0.85) 0%, rgba(29,78,216,0.78) 100%)',
        border: '1.5px solid rgba(96,165,250,0.30)',
        boxShadow: '0 3px 14px rgba(0,0,0,0.30), inset 0 1px 0 rgba(255,255,255,0.07)',
      }}
    >
      {/* Gift icon with soft glow */}
      <span style={{ fontSize: 20, lineHeight: 1, filter: 'drop-shadow(0 1px 4px rgba(251,191,36,0.5))' }}>🎁</span>
      <p className="font-semibold leading-snug" style={{ fontSize: 11.5, color: '#bae6fd' }}>
        Collect coins, unlock skins and<br />beat your high score!
      </p>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Section divider – thin rule with centre glow
// ─────────────────────────────────────────────────────────────────────────────

function Divider() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
      <div style={{ flex: 1, height: 1, background: 'linear-gradient(to right, transparent, rgba(96,165,250,0.20))' }} />
      <div style={{ width: 4, height: 4, borderRadius: '50%', background: 'rgba(96,165,250,0.35)' }} />
      <div style={{ flex: 1, height: 1, background: 'linear-gradient(to left, transparent, rgba(96,165,250,0.20))' }} />
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// HomeScreen – root export
// ─────────────────────────────────────────────────────────────────────────────

export function HomeScreen({ onLogout }: { onLogout: () => void }) {
  const { difficulty, setDifficulty, bestScore, resetGame } = useGameStore()
  const displayName = useGameStore((state) => state.displayName)
  const [showOptions, setShowOptions] = useState(false)
  const [showSkins,   setShowSkins]   = useState(false)
  const [showStats, setShowStats] = useState(false)

  return (
    /*
      Outer wrapper: full viewport with very dark navy surround on desktop.
      Phone shell is centred and enforces the 9:16 aspect ratio.
    */
    <div
      className="w-full h-full flex items-center justify-center"
      style={{ background: 'radial-gradient(ellipse at 50% 40%, #0c1a40 0%, #020617 70%)' }}
    >
      {/* ── Phone shell: 9:16 portrait container ── */}
      <div className="phone-shell" style={{ containerType: 'inline-size' }}>

        {/* 3D canvas background */}
        <div className="absolute inset-0">
          <HomeBackground />
        </div>

        {/* Gradient vignette — lighter at top so sky shows through */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              'linear-gradient(180deg,' +
              'rgba(0,8,32,0.08)  0%,' +
              'rgba(0,8,32,0.18) 18%,' +
              'rgba(0,8,32,0.46) 42%,' +
              'rgba(0,4,16,0.76) 68%,' +
              'rgba(0,2,10,0.90) 88%,' +
              'rgba(0,1,8, 0.95) 100%)',
          }}
        />

        {/* ── Scrollable UI column ── */}
        <div className="absolute inset-0 overflow-y-auto">
          <div
            className="flex flex-col safe-top safe-bottom"
            style={{ padding: '12px 14px 20px', minHeight: '100%' }}
          >

            {/* ── TOP BAR ── */}
            <div className="flex items-center justify-between" style={{ marginBottom: 10 }}>
              <BestScorePanel score={bestScore} />
              <CoinCounter />
            </div>

            <div className="home-account-row">
              <span className="home-account-avatar">{displayName.charAt(0).toUpperCase()}</span>
              <span className="home-account-name">{displayName}</span>
              <button type="button" onClick={onLogout} aria-label="Log out of Math Rush">LOG OUT</button>
            </div>

            {/* ── TITLE ── */}
            <div className="flex justify-center" style={{ marginBottom: 6 }}>
              <TitleLogo />
            </div>

            {/* ── SUBTITLE ── */}
            <div className="text-center" style={{ marginBottom: 12 }}>
              <p
                className="font-semibold"
                style={{
                  fontSize: 12,
                  color: 'rgba(186,230,253,0.88)',
                  textShadow: '0 1px 8px rgba(0,0,0,0.75)',
                  letterSpacing: '0.03em',
                }}
              >
                Think fast. Grow huge. Rule the run.
              </p>
            </div>

            {/* ── GAME PREVIEW ── */}
            <div style={{ marginBottom: 12 }}>
              <GamePreview />
            </div>

            <Divider />

            {/* ── PLAY BUTTON ── */}
            <div style={{ marginBottom: 12 }}>
              <PlayButton onClick={() => { audioManager.playButtonClick(); resetGame() }} />
            </div>

            {/* ── DIFFICULTY SELECTOR ── */}
            <div className="flex" style={{ gap: 7, marginBottom: 12 }}>
              {DIFFS.map((d) => (
                <DiffBtn
                  key={d.id}
                  diff={d}
                  active={difficulty === d.id}
                  onClick={() => {
                    setDifficulty(d.id)
                    void saveSelectedDifficulty(d.id)
                  }}
                />
              ))}
            </div>

            <Divider />

            {/* ── ACTION PILLS ── */}
            <div className="flex" style={{ gap: 10, marginBottom: 12 }}>
              <ActionPill id="btn-options" icon="⚙️" label="OPTIONS" onClick={() => setShowOptions(true)} />
              <ActionPill id="btn-skins"   icon="👕" label="SKINS"   onClick={() => setShowSkins(true)}   />
              <ActionPill id="btn-stats" icon="📊" label="STATS" onClick={() => setShowStats(true)} />
            </div>

            {/* ── LEADERBOARD ── */}
            <div style={{ marginBottom: 10 }}>
              <Leaderboard />
            </div>

            {/* ── GIFT / INFO ── */}
            <GiftInfoBox />

          </div>
        </div>

        {/* ── Modals ── */}
        {showOptions && <OptionsModal onClose={() => setShowOptions(false)} />}
        {showSkins   && <SkinsModal   onClose={() => setShowSkins(false)}   />}
        {showStats && <StatsModal onClose={() => setShowStats(false)} />}
      </div>
    </div>
  )
}
