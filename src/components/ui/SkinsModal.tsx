import { useState } from 'react'
import { purchaseSkin } from '../../services/api'
import { useGameStore } from '../../store/useGameStore'

interface SkinsModalProps {
  onClose: () => void
}

const SKINS = [
  { id: 'default', name: 'Default', color: '#8b5cf6', price: 0 },
  { id: 'ocean', name: 'Ocean', color: '#0ea5e9', price: 500 },
  { id: 'forest', name: 'Forest', color: '#22c55e', price: 800 },
  { id: 'flame', name: 'Flame', color: '#ef4444', price: 1000 },
  { id: 'night', name: 'Night', color: '#312e81', price: 1500 },
  { id: 'gold', name: 'Gold', color: '#f59e0b', price: 2000 },
]

export function SkinsModal({ onClose }: SkinsModalProps) {
  const coins = useGameStore((state) => state.coins)
  const selectedSkin = useGameStore((state) => state.selectedSkin)
  const ownedSkins = useGameStore((state) => state.ownedSkins)
  const backendStatus = useGameStore((state) => state.backendStatus)
  const [busySkin, setBusySkin] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const selectSkin = async (skin: (typeof SKINS)[number]) => {
    const store = useGameStore.getState()
    const owned = store.ownedSkins.includes(skin.id)
    if (!owned && store.coins < skin.price) {
      setError('Not enough coins')
      return
    }

    if (backendStatus !== 'online' || !store.playerId) {
      store.buyAndEquipSkin(skin.id, skin.price)
      setError(null)
      return
    }

    setBusySkin(skin.id)
    setError(null)
    try {
      const result = await purchaseSkin(skin.id)
      if (!result) return
      const current = useGameStore.getState()
      current.syncPlayer({
        id: current.playerId!,
        displayName: current.displayName,
        coins: result.coins,
        bestScore: current.bestScore,
        selectedSkin: result.selectedSkin,
        ownedSkins: current.ownedSkins.includes(skin.id)
          ? current.ownedSkins
          : [...current.ownedSkins, skin.id],
      })
    } catch (purchaseError) {
      setError(purchaseError instanceof Error ? purchaseError.message : 'Could not purchase skin')
    } finally {
      setBusySkin(null)
    }
  }

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.68)', backdropFilter: 'blur(10px)' }} onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label="Skins" className="modal-enter w-full max-w-xs rounded-3xl overflow-hidden" style={{ background: 'linear-gradient(180deg,#1e40af,#1e3a8a)', border: '2px solid #3b82f6', boxShadow: '0 24px 64px rgba(0,0,0,0.7)' }} onClick={(event) => event.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4" style={{ background: 'linear-gradient(135deg,#2563eb,#1d4ed8)' }}>
          <div className="flex items-center gap-2 text-white font-black text-lg tracking-widest"><span>👕</span><span>SKINS</span></div>
          <button onClick={onClose} aria-label="Close skins" className="w-8 h-8 rounded-full text-sky-200" style={{ background: 'rgba(255,255,255,0.1)' }}>×</button>
        </div>
        <div className="grid grid-cols-3 gap-3 p-5">
          {SKINS.map((skin) => {
            const owned = ownedSkins.includes(skin.id)
            const active = selectedSkin === skin.id
            const busy = busySkin === skin.id
            return (
              <button
                key={skin.id}
                disabled={busySkin !== null}
                onClick={() => void selectSkin(skin)}
                className="flex flex-col items-center gap-2 p-3 rounded-2xl transition-all active:scale-95 disabled:opacity-60"
                style={{ background: active ? `${skin.color}22` : 'rgba(255,255,255,0.05)', border: active ? `2px solid ${skin.color}` : '2px solid rgba(255,255,255,0.1)', boxShadow: active ? `0 0 14px ${skin.color}55` : 'none' }}
              >
                <span className="w-12 h-12 rounded-full flex items-center justify-center text-white text-lg font-black" style={{ background: `radial-gradient(circle at 35% 35%,${skin.color}cc,${skin.color})`, boxShadow: `0 4px 12px ${skin.color}66` }}>
                  {busy ? '…' : active ? '✓' : owned ? '' : '🔒'}
                </span>
                <span className="text-white text-[11px] font-bold">{skin.name}</span>
                <span className={`text-[10px] font-bold ${owned ? 'text-green-400' : coins >= skin.price ? 'text-yellow-400' : 'text-red-400'}`}>
                  {owned ? (active ? 'Equipped' : 'Owned') : `● ${skin.price}`}
                </span>
              </button>
            )
          })}
        </div>
        <p className="text-center text-xs pb-4" style={{ color: error ? '#fca5a5' : '#7dd3fc' }}>
          {error ?? `${coins.toLocaleString()} coins available`}
        </p>
      </div>
    </div>
  )
}
