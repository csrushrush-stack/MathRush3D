import './index.css'
import { useGameStore } from './store/useGameStore'
import { HomeScreen }   from './screens/HomeScreen'
import { AuthScreen } from './screens/AuthScreen'
import { lazy, Suspense, useEffect, useState } from 'react'
import { bootstrapPlayer, logoutAccount } from './services/api'
import { audioManager } from './utils/audioManager'

const GameScreen = lazy(() => import('./screens/GameScreen').then((module) => ({ default: module.GameScreen })))
const AdminScreen = lazy(() => import('./screens/AdminScreen').then((module) => ({ default: module.AdminScreen })))
const DownloadPage = lazy(() => import('./screens/DownloadPage').then((module) => ({ default: module.DownloadPage })))

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
  const isDownloadPage = window.location.pathname === '/download' || window.location.pathname === '/download/'
  const isAdminPage = window.location.pathname === '/admin' || window.location.pathname === '/admin/'
  const [authState, setAuthState] = useState<'checking' | 'authenticated' | 'unauthenticated'>('checking')
  const phase   = useGameStore((s) => s.phase)
  const gameKey = useGameStore((s) => s.gameKey)
  const soundEffects = useGameStore((s) => s.settings.soundEffects)
  const isGame  = phase === 'playing' || phase === 'paused' || phase === 'gameover' || phase === 'win'

  useEffect(() => {
    if (isDownloadPage) return
    void bootstrapPlayer().then((authenticated) => {
      setAuthState(authenticated ? 'authenticated' : 'unauthenticated')
    })
  }, [isDownloadPage])

  useEffect(() => {
    audioManager.setEnabled(soundEffects)
  }, [soundEffects])

  // Development-only telemetry hook: exposes the live store instance that this
  // component graph actually uses, for the automated playthrough driver.
  // Stripped from production builds by the import.meta.env.DEV guard.
  useEffect(() => {
    if (import.meta.env.DEV) {
      ;(window as unknown as Record<string, unknown>).__mrState = () => useGameStore.getState()
    }
  }, [])

  if (isDownloadPage) return <Suspense fallback={<div className="auth-loading">Loading download page…</div>}><DownloadPage /></Suspense>

  return (
    <div className="w-full h-full">
      {authState === 'checking' && <div className="auth-loading"><div className="auth-loader" /><span>Loading Math Rush…</span></div>}
      {authState === 'unauthenticated' && <AuthScreen onAuthenticated={() => setAuthState('authenticated')} />}
      {authState === 'authenticated' && (
        <Suspense fallback={<div className="auth-loading"><div className="auth-loader" /><span>Loading screen…</span></div>}>
          {isAdminPage
            ? <AdminScreen onLogout={() => setAuthState('unauthenticated')} />
            : isGame
            ? <GameScreen key={gameKey} />
            : <HomeScreen onLogout={() => void logoutAccount().finally(() => setAuthState('unauthenticated'))} />}
        </Suspense>
      )}
    </div>
  )
}

export default App
