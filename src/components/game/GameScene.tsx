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
import { GameTrack }        from './GameTrack'
import { CrowdRunner }      from './CrowdRunner'
import { FollowCamera }     from './FollowCamera'
import { GateManager }      from './GateManager'
import { ObstacleManager }  from './ObstacleManager'
import { BossManager }      from './BossManager'
import { generateGatePairs } from '../../utils/mathGates'
import { generateObstacles } from '../../utils/obstacles'
import { calculateLevelBalance } from '../../utils/gameBalance'
import { useGameStore } from '../../store/useGameStore'
import type { CrowdController } from './CrowdRuntime'

interface GameSceneProps {
  difficulty: string
  isPaused:   boolean
  onDistanceUpdate?: (dist: number) => void
}

export function GameScene({
  difficulty,
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
  const gates = useMemo(() => generateGatePairs(difficulty), [difficulty])
  const obstacles = useMemo(() => generateObstacles(difficulty), [difficulty])
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
      style={{ background: 'linear-gradient(180deg,#0c3fa0 0%,#1a70e0 50%,#3baaf8 100%)' }}
    >
      <Suspense fallback={null}>

        {/* ── Sky ── */}
        <Sky
          sunPosition={[80, 22, 40]}
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
        <fog attach="fog" args={['#1d4ed8', 35, 160]} />

        {/* ── Track (infinite tiled road) ── */}
        <GameTrack crowdZRef={crowdZRef as React.RefObject<number>} />

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
