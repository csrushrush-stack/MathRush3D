/**
 * GameScene – The full React Three Fiber <Canvas> for gameplay.
 *
 * Wires together:
 *   - GameTrack      (infinite scrolling runway)
 *   - CrowdRunner    (player crowd with movement)
 *   - GateManager    (10 math gate pairs + collision)
 *   - ObstacleManager(5 obstacles between gates)
 *   - BossManager    (boss at Z=−275, finish line at Z=−300)
 *   - FollowCamera   (smooth chase camera)
 *   - Lighting + sky + fog
 *
 * Key design decision:
 *   The crowd's world position is shared between components via
 *   plain React refs (crowdXRef, crowdZRef) instead of Zustand.
 *   This avoids triggering React re-renders at 60fps.
 */
import { useRef, useCallback, useEffect, useMemo } from 'react'
import { Canvas }              from '@react-three/fiber'
import { Sky }                 from '@react-three/drei'
import { Suspense }            from 'react'
import { GameTrack, type TrackTheme } from './GameTrack'
import { CrowdRunner }      from './CrowdRunner'
import { FollowCamera }     from './FollowCamera'
import { GateManager }      from './GateManager'
import { ObstacleManager }  from './ObstacleManager'
import { BossManager }      from './BossManager'
import { generateGatePairs } from '../../utils/mathGates'
import { generateObstacles } from '../../utils/obstacles'
import { balanceObstaclesForRoute, calculateLevelBalance } from '../../utils/gameBalance'
import { useGameStore } from '../../store/useGameStore'
import type { CrowdController } from './CrowdRuntime'
import { createLevelRandom } from '../../utils/levelProgress'

interface GameSceneProps {
  difficulty: string
  level: number
  isPaused:   boolean
  onDistanceUpdate?: (dist: number) => void
}

interface LevelTheme {
  background: string
  fog: string
  sky: [number, number, number]
  track: TrackTheme
}

const LEVEL_THEMES: Record<string, LevelTheme> = {
  easy: {
    background: 'linear-gradient(180deg,#0891b2 0%,#38bdf8 52%,#a7f3d0 100%)',
    fog: '#38bdf8',
    sky: [70, 28, 35],
    track: { road: '#0f766e', shoulder: '#155e75', rail: '#fde047', dash: '#ecfeff' },
  },
  medium: {
    background: 'linear-gradient(180deg,#0c3fa0 0%,#1a70e0 50%,#3baaf8 100%)',
    fog: '#1d4ed8',
    sky: [80, 22, 40],
    track: { road: '#1e40af', shoulder: '#1e3a8a', rail: '#fbbf24', dash: '#ffffff' },
  },
  hard: {
    background: 'linear-gradient(180deg,#7c2d12 0%,#c2410c 48%,#f59e0b 100%)',
    fog: '#c2410c',
    sky: [55, 10, 20],
    track: { road: '#7c2d12', shoulder: '#4c1d95', rail: '#fb7185', dash: '#ffedd5' },
  },
  expert: {
    background: 'linear-gradient(180deg,#1e1b4b 0%,#4c1d95 50%,#7c3aed 100%)',
    fog: '#4c1d95',
    sky: [35, 16, 55],
    track: { road: '#312e81', shoulder: '#0f172a', rail: '#22d3ee', dash: '#e0e7ff' },
  },
}

export function GameScene({
  difficulty,
  level,
  isPaused,
  onDistanceUpdate,
}: GameSceneProps) {
  // Shared position refs — read by FollowCamera, GameTrack, GateManager each frame
  const crowdXRef = useRef<number>(0)
  const crowdZRef = useRef<number>(0)
  const crowdDepthRef = useRef<number>(0)
  const crowdControllerRef = useRef<CrowdController | null>(null)
  const cameraShakeRef = useRef<number>(0)
  const reducedEffects = useGameStore((state) => state.settings.reducedEffects)
  const theme = LEVEL_THEMES[difficulty] ?? LEVEL_THEMES.medium
  const gates = useMemo(
    () => generateGatePairs(difficulty, createLevelRandom(`${difficulty}-${level}-gates`)),
    [difficulty, level],
  )
  const gateZs = useMemo(() => gates.map((gate) => gate.worldZ), [gates])
  const rawObstacles = useMemo(
    () => generateObstacles(difficulty, createLevelRandom(`${difficulty}-${level}-obstacles`), level),
    [difficulty, level],
  )
  const obstacles = useMemo(
    () => balanceObstaclesForRoute(gates, rawObstacles, difficulty, level),
    [difficulty, gates, level, rawObstacles],
  )
  const balance = useMemo(
    () => calculateLevelBalance(gates, obstacles),
    [gates, obstacles],
  )

  useEffect(() => {
    useGameStore.getState().initializeLevel(balance)
  }, [balance])

  const handlePositionUpdate = useCallback(
    (worldZ: number, worldX: number) => {
      crowdZRef.current = worldZ
      crowdXRef.current = worldX
      onDistanceUpdate?.(-worldZ)
    },
    [onDistanceUpdate],
  )

  return (
    <Canvas
      shadows={false}
      dpr={reducedEffects ? 1 : [1, 1.5]}
      gl={{ antialias: !reducedEffects, powerPreference: 'high-performance' }}
      performance={{ min: 0.6 }}
      // Portrait-tuned starting position matches FollowCamera's first-frame target
      // FOV 68 gives generous vertical coverage on a 9:16 shell
      camera={{ position: [0, 3.2, 6], fov: 68, near: 0.1, far: 400 }}
      style={{ background: theme.background }}
    >
      <Suspense fallback={null}>

        {/* ── Sky ── */}
        <Sky
          sunPosition={theme.sky}
          turbidity={0.5}
          rayleigh={3.2}
          mieCoefficient={0.002}
          mieDirectionalG={0.90}
        />

        {/* ── Lighting ── */}
        <hemisphereLight intensity={1.55} color="#dbeafe" groundColor="#172554" />
        <directionalLight
          position={[8, 20, 10]}
          intensity={2.3}
        />

        {/* ── Fog — extended for the longer 300-unit level ── */}
        <fog attach="fog" args={[theme.fog, 35, 160]} />

        {/* ── Track (infinite tiled road) ── */}
        <GameTrack crowdZRef={crowdZRef as React.RefObject<number>} theme={theme.track} />

        {/* ── Math gate pairs (exactly 10) ── */}
        <GateManager
          pairs={gates}
          crowdXRef={crowdXRef as React.RefObject<number>}
          crowdZRef={crowdZRef as React.RefObject<number>}
          isPaused={isPaused}
        />

        {/* ── Obstacles (5 between the gate pairs) ── */}
        <ObstacleManager
          obstacles={obstacles}
          crowdZRef={crowdZRef as React.RefObject<number>}
          crowdControllerRef={crowdControllerRef}
          cameraShakeRef={cameraShakeRef}
          isPaused={isPaused}
        />

        {/* ── Boss (Z=−275) + Finish Line (Z=−300) ── */}
        <BossManager
          balance={balance}
          crowdZRef={crowdZRef as React.RefObject<number>}
          crowdControllerRef={crowdControllerRef}
          cameraShakeRef={cameraShakeRef}
          isPaused={isPaused}
        />

        {/* ── Crowd runner (player's crowd — subscribes to crowdSize internally) ── */}
        <CrowdRunner
          difficulty={difficulty}
          isPaused={isPaused}
          gateZs={gateZs}
          controllerRef={crowdControllerRef}
          crowdDepthRef={crowdDepthRef}
          onPositionUpdate={handlePositionUpdate}
        />

        {/* ── Follow camera ── */}
        <FollowCamera
          crowdXRef={crowdXRef as React.RefObject<number>}
          crowdZRef={crowdZRef as React.RefObject<number>}
          crowdDepthRef={crowdDepthRef}
          cameraShakeRef={cameraShakeRef}
        />

      </Suspense>
    </Canvas>
  )
}
