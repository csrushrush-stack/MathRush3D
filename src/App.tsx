import './index.css'
import { useGameStore } from './store/useGameStore'
import { HomeScreen }   from './screens/HomeScreen'
import { GameScreen }   from './screens/GameScreen'
import { AuthScreen } from './screens/AuthScreen'
import { useEffect, useState } from 'react'
import { bootstrapPlayer, logoutAccount } from './services/api'
import { audioManager } from './utils/audioManager'

/**
 * App – root component.
 *
 * Screen switching via Zustand phase:
 *   'home'     → HomeScreen
 *   'playing'  → GameScreen
 *   'paused'   → GameScreen (pause overlay rendered inside GameScreen)
 *   'gameover' → GameScreen (game-over overlay rendered inside GameScreen)
 *
 * gameKey increments on every resetGame() call.
 * Using it as the <GameScreen key> forces a full remount on each new game,
 * which resets all R3F component-local state:
 *   - CrowdRunner posX/posZ refs
 *   - GateManager triggeredIds ref
 *   - ObstacleManager processedIds ref
 * This prevents ghost-state from a previous run bleeding into the new one.
 */
function App() {
  const [authState, setAuthState] = useState<'checking' | 'authenticated' | 'unauthenticated'>('checking')
  const phase   = useGameStore((s) => s.phase)
  const gameKey = useGameStore((s) => s.gameKey)
  const soundEffects = useGameStore((s) => s.settings.soundEffects)
  const isGame  = phase === 'playing' || phase === 'paused' || phase === 'gameover' || phase === 'win'

  useEffect(() => {
    void bootstrapPlayer().then((authenticated) => {
      setAuthState(authenticated ? 'authenticated' : 'unauthenticated')
    })
  }, [])

  useEffect(() => {
    audioManager.setEnabled(soundEffects)
  }, [soundEffects])

  return (
    <div className="w-full h-full">
      {authState === 'checking' && <div className="auth-loading"><div className="auth-loader" /><span>Loading Math Rush…</span></div>}
      {authState === 'unauthenticated' && <AuthScreen onAuthenticated={() => setAuthState('authenticated')} />}
      {authState === 'authenticated' && (
        isGame
          ? <GameScreen key={gameKey} />
          : <HomeScreen onLogout={() => void logoutAccount().finally(() => setAuthState('unauthenticated'))} />
      )}
    </div>
  )
}

export default App
