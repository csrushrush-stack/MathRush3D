import { useGameStore } from '../../store/useGameStore'

export function StatsModal({ onClose }: { onClose: () => void }) {
  const stats = useGameStore((state) => state.lifetimeStats)
  const bestScore = useGameStore((state) => state.bestScore)
  const backendStatus = useGameStore((state) => state.backendStatus)
  const winRate = stats.gamesPlayed > 0 ? Math.round(stats.gamesWon / stats.gamesPlayed * 100) : 0
  const cards = [
    ['Games', stats.gamesPlayed.toLocaleString()],
    ['Wins', stats.gamesWon.toLocaleString()],
    ['Win rate', `${winRate}%`],
    ['Best score', bestScore.toLocaleString()],
    ['Best bonus', `x${stats.highestMultiplier}`],
    ['Math gained', stats.totalMathGain.toLocaleString()],
    ['Total score', stats.totalScore.toLocaleString()],
  ]

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.68)', backdropFilter: 'blur(10px)' }} onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label="Statistics" className="modal-enter w-full max-w-xs rounded-3xl overflow-hidden" style={{ background: 'linear-gradient(180deg,#1e40af,#1e3a8a)', border: '2px solid #3b82f6', boxShadow: '0 24px 64px rgba(0,0,0,0.7)' }} onClick={(event) => event.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4" style={{ background: 'linear-gradient(135deg,#2563eb,#1d4ed8)' }}>
          <div className="text-white font-black text-lg tracking-widest">📊 STATS</div>
          <button onClick={onClose} aria-label="Close statistics" className="w-8 h-8 rounded-full text-sky-200" style={{ background: 'rgba(255,255,255,0.1)' }}>×</button>
        </div>
        <div className="grid grid-cols-2 gap-2 p-5">
          {cards.map(([label, value], index) => (
            <div key={label} className={index === cards.length - 1 ? 'col-span-2' : ''} style={{ padding: 12, borderRadius: 14, textAlign: 'center', background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(147,197,253,0.18)' }}>
              <div style={{ color: '#93c5fd', fontSize: 9, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase' }}>{label}</div>
              <div style={{ color: '#ffffff', fontSize: 22, fontWeight: 900, marginTop: 3 }}>{value}</div>
            </div>
          ))}
        </div>
        <p className="text-center text-xs pb-4" style={{ color: backendStatus === 'online' ? '#86efac' : '#fbbf24' }}>
          {backendStatus === 'online' ? 'Synced statistics' : 'Local statistics'}
        </p>
      </div>
    </div>
  )
}
