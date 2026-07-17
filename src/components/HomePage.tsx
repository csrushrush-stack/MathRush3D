/**
 * HomePage – placeholder landing screen for Math Rush 3D.
 * Replace this with real menu UI in a later phase.
 */
export function HomePage() {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center z-10 pointer-events-none">
      {/* Glass card */}
      <div
        className="pointer-events-auto px-10 py-8 rounded-2xl text-center"
        style={{
          background: 'rgba(10, 10, 26, 0.65)',
          backdropFilter: 'blur(16px)',
          border: '1px solid rgba(99, 102, 241, 0.35)',
          boxShadow: '0 0 60px rgba(99, 102, 241, 0.15), 0 4px 32px rgba(0,0,0,0.5)',
        }}
      >
        {/* Logo / title */}
        <h1
          className="text-5xl font-black tracking-tight mb-2"
          style={{
            background: 'linear-gradient(135deg, #818cf8 0%, #6366f1 40%, #a5b4fc 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}
        >
          Math Rush <span style={{ WebkitTextFillColor: '#f59e0b' }}>3D</span>
        </h1>
        <p className="text-indigo-300 text-sm tracking-widest uppercase mb-8">
          Think Fast · Run Faster
        </p>

        {/* Placeholder buttons */}
        <div className="flex flex-col gap-3 w-64 mx-auto">
          <button
            disabled
            className="py-3 rounded-xl text-white font-semibold text-base cursor-not-allowed opacity-60"
            style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}
          >
            Play  ▶
          </button>
          <button
            disabled
            className="py-3 rounded-xl font-semibold text-indigo-300 text-base cursor-not-allowed opacity-40"
            style={{ border: '1px solid rgba(99,102,241,0.4)' }}
          >
            Leaderboard
          </button>
          <button
            disabled
            className="py-3 rounded-xl font-semibold text-indigo-300 text-base cursor-not-allowed opacity-40"
            style={{ border: '1px solid rgba(99,102,241,0.4)' }}
          >
            Settings
          </button>
        </div>

        <p className="text-indigo-500 text-xs mt-6">
          🚧 Placeholder – Full game coming soon
        </p>
      </div>
    </div>
  )
}
