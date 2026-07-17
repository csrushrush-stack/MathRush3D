import { useGameStore, type GameSettings } from '../../store/useGameStore'
import { saveSettings } from '../../services/api'

interface OptionsModalProps {
  onClose: () => void
}

const SETTINGS: Array<{ key: keyof GameSettings; label: string; icon: string }> = [
  { key: 'music', label: 'Music', icon: '♪' },
  { key: 'soundEffects', label: 'Sound effects', icon: '🔊' },
  { key: 'vibration', label: 'Vibration', icon: '📳' },
  { key: 'notifications', label: 'Notifications', icon: '🔔' },
  { key: 'reducedEffects', label: 'Battery saver', icon: '🔋' },
]

function Toggle({ on, onClick, label }: { on: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={onClick}
      className="relative w-12 h-7 rounded-full flex-shrink-0 transition-all"
      style={{
        background: on ? 'linear-gradient(90deg,#4ade80,#16a34a)' : 'rgba(100,116,139,0.65)',
        boxShadow: on ? '0 0 10px rgba(74,222,128,0.45)' : 'none',
        border: '1px solid rgba(255,255,255,0.18)',
      }}
    >
      <span
        className="absolute top-0.5 h-6 w-6 rounded-full bg-white shadow-md transition-all"
        style={{ left: on ? 'calc(100% - 26px)' : 2 }}
      />
    </button>
  )
}

export function OptionsModal({ onClose }: OptionsModalProps) {
  const settings = useGameStore((state) => state.settings)
  const setSetting = useGameStore((state) => state.setSetting)
  const backendStatus = useGameStore((state) => state.backendStatus)

  const toggle = (key: keyof GameSettings) => {
    const next = { ...settings, [key]: !settings[key] }
    setSetting(key, next[key])
    void saveSettings(next).catch(() => useGameStore.getState().setBackendStatus('offline'))
  }

  return (
    <div
      className="absolute inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.68)', backdropFilter: 'blur(10px)' }}
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Options"
        className="modal-enter w-full max-w-xs rounded-3xl overflow-hidden"
        style={{
          background: 'linear-gradient(180deg,#1e40af 0%,#1e3a8a 100%)',
          border: '2px solid #3b82f6',
          boxShadow: '0 24px 64px rgba(0,0,0,0.7)',
        }}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4" style={{ background: 'linear-gradient(135deg,#2563eb,#1d4ed8)' }}>
          <div className="flex items-center gap-2 text-white font-black text-lg tracking-widest">
            <span>⚙</span><span>OPTIONS</span>
          </div>
          <button onClick={onClose} aria-label="Close options" className="w-8 h-8 rounded-full text-sky-200" style={{ background: 'rgba(255,255,255,0.1)' }}>×</button>
        </div>
        <div className="px-5 py-3">
          {SETTINGS.map((setting, index) => (
            <div key={setting.key} className="flex items-center justify-between py-3" style={{ borderBottom: index < SETTINGS.length - 1 ? '1px solid rgba(59,130,246,0.25)' : 'none' }}>
              <div className="flex items-center gap-3">
                <span className="text-xl">{setting.icon}</span>
                <span className="text-sky-100 font-semibold text-sm">{setting.label}</span>
              </div>
              <Toggle on={settings[setting.key]} onClick={() => toggle(setting.key)} label={setting.label} />
            </div>
          ))}
        </div>
        <p className="text-center text-xs pb-4" style={{ color: backendStatus === 'online' ? '#86efac' : '#fbbf24' }}>
          {backendStatus === 'online' ? 'Progress synced to PostgreSQL' : 'Offline mode - progress is queued'}
        </p>
      </div>
    </div>
  )
}
