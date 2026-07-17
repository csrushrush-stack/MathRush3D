import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { useGameStore } from '../../store/useGameStore'
import { audioManager } from '../../utils/audioManager'
import { crossedPlane } from '../../utils/gameBalance'
import type { ObstacleData } from '../../utils/obstacles'
import type { CrowdAvoidanceArea, CrowdController } from './CrowdRuntime'
import { InstancedEnemyCrowd } from './InstancedEnemyCrowd'

type Resolution = 'active' | 'hit' | 'dodged'

interface ObstacleState extends ObstacleData {
  resolution: Resolution
  enemyRemaining: number
  impactPulse: number
}

function createSignTexture(title: string, subtitle: string, color: string) {
  const canvas = document.createElement('canvas')
  canvas.width = 384
  canvas.height = 192
  const context = canvas.getContext('2d')
  if (!context) return new THREE.CanvasTexture(canvas)
  context.fillStyle = 'rgba(10, 8, 18, 0.78)'
  context.fillRect(8, 8, 368, 176)
  context.strokeStyle = color
  context.lineWidth = 8
  context.strokeRect(8, 8, 368, 176)
  context.textAlign = 'center'
  context.textBaseline = 'middle'
  context.fillStyle = '#ffffff'
  context.shadowColor = color
  context.shadowBlur = 22
  context.font = '900 82px Inter, Arial, sans-serif'
  context.fillText(title, 192, 91)
  context.shadowBlur = 0
  context.fillStyle = color
  context.font = '800 25px Inter, Arial, sans-serif'
  context.fillText(subtitle, 192, 151)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.minFilter = THREE.LinearFilter
  return texture
}

function DamageSign({ title, subtitle, color, position = [0, 1.2, 0.28] }: {
  title: string
  subtitle: string
  color: string
  position?: [number, number, number]
}) {
  const texture = useMemo(() => createSignTexture(title, subtitle, color), [color, subtitle, title])
  useEffect(() => () => texture.dispose(), [texture])
  return (
    <mesh position={position}>
      <planeGeometry args={[2.2, 1.1]} />
      <meshBasicMaterial map={texture} transparent toneMapped={false} />
    </mesh>
  )
}

function AnimatedObstacle({ resolution, children, position }: {
  resolution: Resolution
  children: React.ReactNode
  position: [number, number, number]
}) {
  const groupRef = useRef<THREE.Group>(null)
  const scale = useRef(1)
  useFrame((_, delta) => {
    if (resolution === 'active' || !groupRef.current) return
    scale.current = Math.max(0, scale.current - Math.min(delta, 0.05) * 5.5)
    groupRef.current.scale.setScalar(scale.current)
    groupRef.current.rotation.y += delta * (resolution === 'hit' ? 2.4 : 0.8)
    groupRef.current.visible = scale.current > 0.01
  })
  return <group ref={groupRef} position={position}>{children}</group>
}

function WallObstacle({ obstacle }: { obstacle: ObstacleState }) {
  // Keep the blocked lane narrow enough that the widest seven-column crowd
  // can fit completely through the open side of the five-unit track.
  const centerX = obstacle.blockerSide === 'left' ? -1.35 : 1.35
  const { scene } = useGLTF('/models/kenney-castle-wall.glb')
  const model = useMemo(() => {
    const clone = scene.clone(true)
    clone.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.castShadow = true
        child.receiveShadow = true
      }
    })
    return clone
  }, [scene])
  return (
    <AnimatedObstacle resolution={obstacle.resolution} position={[0, 0, obstacle.worldZ]}>
      <primitive object={model} position={[centerX, 0, 0]} scale={[1.6, 1.6, 0.55]} />
    </AnimatedObstacle>
  )
}

useGLTF.preload('/models/kenney-castle-wall.glb')

function BlockerObstacle({ obstacle }: { obstacle: ObstacleState }) {
  const blockedX = obstacle.blockerSide === 'left' ? -1.3 : 1.3
  return (
    <AnimatedObstacle resolution={obstacle.resolution} position={[0, 0, obstacle.worldZ]}>
      <mesh position={[blockedX, 0.95, 0]}>
        <boxGeometry args={[2.35, 1.9, 0.48]} />
        <meshStandardMaterial color="#d97706" emissive="#f59e0b" emissiveIntensity={0.38} roughness={0.28} metalness={0.4} />
      </mesh>
      {[0.38, 0.95, 1.52].map((y) => (
        <mesh key={y} position={[blockedX, y, 0.25]}>
          <boxGeometry args={[2.12, 0.16, 0.04]} />
          <meshBasicMaterial color="#1c1917" />
        </mesh>
      ))}
    </AnimatedObstacle>
  )
}

function BattleFlash({ pulse }: { pulse: number }) {
  const ref = useRef<THREE.Mesh>(null)
  const age = useRef(1)
  useEffect(() => { age.current = 0 }, [pulse])
  useFrame((_, delta) => {
    age.current += delta * 5
    if (!ref.current) return
    const visible = age.current < 1
    ref.current.visible = visible
    if (visible) {
      const scale = 0.2 + age.current * 1.7
      ref.current.scale.setScalar(scale)
      const material = ref.current.material as THREE.MeshBasicMaterial
      material.opacity = Math.max(0, 0.8 * (1 - age.current))
    }
  })
  return (
    <mesh ref={ref} position={[0, 0.75, 0.4]}>
      <octahedronGeometry args={[0.55, 0]} />
      <meshBasicMaterial color="#fef08a" transparent opacity={0} depthWrite={false} />
    </mesh>
  )
}

function EnemyObstacle({ obstacle, fighting }: { obstacle: ObstacleState; fighting: boolean }) {
  return (
    <AnimatedObstacle resolution={obstacle.resolution} position={[0, 0, obstacle.worldZ]}>
      <InstancedEnemyCrowd count={obstacle.enemyRemaining} fighting={fighting} />
      <BattleFlash pulse={obstacle.impactPulse} />
      <DamageSign title={obstacle.enemyRemaining.toString()} subtitle={fighting ? 'BATTLE!' : 'ENEMY CROWD'} color="#fda4af" position={[0, 2.15, 0.15]} />
    </AnimatedObstacle>
  )
}

function getHammerX(obstacle: ObstacleData, elapsedTime: number) {
  return Math.sin(elapsedTime * obstacle.hammerSpeed + obstacle.hammerPhase) * 1.65
}

function HammerObstacle({ obstacle }: { obstacle: ObstacleState }) {
  const movingRef = useRef<THREE.Group>(null)
  useFrame(({ clock }) => {
    if (movingRef.current && obstacle.resolution === 'active') movingRef.current.position.x = getHammerX(obstacle, clock.elapsedTime)
  })
  return (
    <AnimatedObstacle resolution={obstacle.resolution} position={[0, 0, obstacle.worldZ]}>
      <group ref={movingRef}>
        <mesh position={[0, 0.75, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.42, 0.42, 1.45, 10]} />
          <meshStandardMaterial color="#7c3aed" emissive="#a78bfa" emissiveIntensity={0.45} roughness={0.25} metalness={0.6} />
        </mesh>
        <mesh position={[0, 1.65, 0]}>
          <boxGeometry args={[0.2, 1.25, 0.2]} />
          <meshStandardMaterial color="#334155" metalness={0.8} roughness={0.22} />
        </mesh>
      </group>
    </AnimatedObstacle>
  )
}

interface ObstacleManagerProps {
  obstacles: ObstacleData[]
  crowdZRef: React.RefObject<number>
  crowdControllerRef: React.MutableRefObject<CrowdController | null>
  cameraShakeRef: React.MutableRefObject<number>
  isPaused: boolean
}

interface ContactState { crowdBefore: number; damage: number }
interface BattleState { obstacle: ObstacleData; crowdBefore: number; remaining: number; elapsed: number; strike: number }

export function ObstacleManager({
  obstacles: source,
  crowdZRef,
  crowdControllerRef,
  cameraShakeRef,
  isPaused,
}: ObstacleManagerProps) {
  const [obstacles, setObstacles] = useState<ObstacleState[]>(() => source.map((obstacle) => ({
    ...obstacle,
    resolution: 'active',
    enemyRemaining: obstacle.enemyStrength,
    impactPulse: 0,
  })))
  const processed = useRef(new Set<number>())
  const contacts = useRef(new Map<number, ContactState>())
  const battle = useRef<BattleState | null>(null)
  const previousZ = useRef(0)

  const resolveObstacle = (obstacle: ObstacleData, contact: ContactState) => {
    const state = useGameStore.getState()
    const crowdAfter = state.crowdSize
    const outcome = contact.damage > 0 ? 'hit' : 'dodged'
    state.recordObstacle({
      obstacleIndex: obstacle.id,
      worldZ: obstacle.worldZ,
      obstacleType: obstacle.type,
      outcome,
      crowdBefore: contact.crowdBefore,
      crowdAfter,
      damage: contact.damage,
    })
    processed.current.add(obstacle.id)
    contacts.current.delete(obstacle.id)
    setObstacles((current) => current.map((item) => item.id === obstacle.id
      ? { ...item, resolution: outcome }
      : item))
    if (contact.damage > 0) audioManager.playObstacleHit()
    else audioManager.playDodge()
  }

  useFrame(({ clock }, frameDelta) => {
    const currentZ = crowdZRef.current
    if (isPaused) {
      previousZ.current = currentZ
      return
    }
    const controller = crowdControllerRef.current
    if (!controller) return

    const avoidance: CrowdAvoidanceArea[] = []
    for (const obstacle of source) {
      if (processed.current.has(obstacle.id) || obstacle.type === 'enemy') continue
      if (obstacle.type === 'wall') {
        avoidance.push({
          key: `wall-${obstacle.id}`,
          centerX: obstacle.blockerSide === 'left' ? -1.35 : 1.35,
          centerZ: obstacle.worldZ,
          halfWidth: 0.8,
          halfDepth: 0.36,
          preferredSide: obstacle.blockerSide === 'left' ? 1 : -1,
          strength: 2.35,
        })
      } else if (obstacle.type === 'blocker') {
        avoidance.push({
          key: `blocker-${obstacle.id}`,
          centerX: obstacle.blockerSide === 'left' ? -1.3 : 1.3,
          centerZ: obstacle.worldZ,
          halfWidth: 1.18,
          halfDepth: 0.36,
          preferredSide: obstacle.blockerSide === 'left' ? 1 : -1,
          strength: 2.6,
        })
      } else {
        avoidance.push({
          key: `hammer-${obstacle.id}`,
          centerX: getHammerX(obstacle, clock.elapsedTime),
          centerZ: obstacle.worldZ,
          halfWidth: 0.74,
          halfDepth: 0.4,
          strength: 1.4,
        })
      }
    }
    controller.setAvoidanceAreas(avoidance)

    const activeBattle = battle.current
    if (activeBattle) {
      activeBattle.elapsed += Math.min(frameDelta, 0.05)
      if (activeBattle.elapsed >= 0.1) {
        activeBattle.elapsed -= 0.1
        activeBattle.strike += 1
        const removed = controller.removeFront(1, `enemy-${activeBattle.obstacle.id}-${activeBattle.strike}`, {
          x: activeBattle.strike % 2 === 0 ? 2.2 : -2.2,
          z: 0.8,
          upward: 2.6,
        })
        if (removed === 0) {
          useGameStore.getState().failRun()
          audioManager.playGameOver()
          battle.current = null
          return
        }
        activeBattle.remaining -= 1
        cameraShakeRef.current = Math.max(cameraShakeRef.current, 0.72)
        audioManager.playBossHit()
        setObstacles((current) => current.map((item) => item.id === activeBattle.obstacle.id
          ? { ...item, enemyRemaining: activeBattle.remaining, impactPulse: item.impactPulse + 1 }
          : item))

        if (controller.getAliveCount() <= 0 && activeBattle.remaining > 0) {
          useGameStore.getState().failRun()
          audioManager.playGameOver()
          battle.current = null
          return
        }

        if (activeBattle.remaining <= 0) {
          const state = useGameStore.getState()
          state.recordObstacle({
            obstacleIndex: activeBattle.obstacle.id,
            worldZ: activeBattle.obstacle.worldZ,
            obstacleType: 'enemy',
            outcome: 'defeated',
            crowdBefore: activeBattle.crowdBefore,
            crowdAfter: state.crowdSize,
            damage: activeBattle.crowdBefore - state.crowdSize,
          })
          processed.current.add(activeBattle.obstacle.id)
          setObstacles((current) => current.map((item) => item.id === activeBattle.obstacle.id
            ? { ...item, resolution: 'hit', enemyRemaining: 0 }
            : item))
          battle.current = null
          state.setRunStage('run')
          audioManager.playBossDefeat()
        }
      }
      previousZ.current = currentZ
      return
    }

    for (const obstacle of source) {
      if (processed.current.has(obstacle.id)) continue

      if (obstacle.type === 'enemy') {
        if (!crossedPlane(previousZ.current, currentZ, obstacle.worldZ)) continue
        const state = useGameStore.getState()
        if (state.crowdSize <= obstacle.enemyStrength) {
          // Still show the clash instead of resolving the loss instantly.
          battle.current = { obstacle, crowdBefore: state.crowdSize, remaining: obstacle.enemyStrength, elapsed: 0, strike: 0 }
        } else {
          battle.current = { obstacle, crowdBefore: state.crowdSize, remaining: obstacle.enemyStrength, elapsed: 0, strike: 0 }
        }
        state.setRunStage('battle')
        cameraShakeRef.current = 0.55
        setObstacles((current) => current.map((item) => item.id === obstacle.id
          ? { ...item, impactPulse: item.impactPulse + 1 }
          : item))
        continue
      }

      if (currentZ > obstacle.worldZ + 0.55) continue
      let contact = contacts.current.get(obstacle.id)
      if (!contact) {
        contact = { crowdBefore: useGameStore.getState().crowdSize, damage: 0 }
        contacts.current.set(obstacle.id, contact)
      }

      const depth = controller.getDepth()
      if (currentZ >= obstacle.worldZ - depth - 0.7) {
        let centerX = 0
        let halfWidth = 0
        let halfDepth = 0.36
        let impulseX = 0
        if (obstacle.type === 'wall') {
          centerX = obstacle.blockerSide === 'left' ? -1.35 : 1.35
          halfWidth = 0.8
          impulseX = obstacle.blockerSide === 'left' ? 2.4 : -2.4
        } else if (obstacle.type === 'blocker') {
          centerX = obstacle.blockerSide === 'left' ? -1.3 : 1.3
          halfWidth = 1.18
          impulseX = obstacle.blockerSide === 'left' ? 2 : -2
        } else {
          centerX = getHammerX(obstacle, clock.elapsedTime)
          halfWidth = 0.74
          halfDepth = 0.4
          impulseX = Math.cos(clock.elapsedTime * obstacle.hammerSpeed + obstacle.hammerPhase) >= 0 ? 3.2 : -3.2
        }
        const hammerPassLimit = obstacle.type === 'hammer'
          ? Math.max(1, Math.ceil(contact.crowdBefore * 0.22))
          : Number.POSITIVE_INFINITY
        const remainingPassHits = Math.max(0, hammerPassLimit - contact.damage)
        const removed = remainingPassHits > 0 ? controller.hitArea({
          key: `${obstacle.type}-${obstacle.id}`,
          centerX,
          centerZ: obstacle.worldZ,
          halfWidth,
          halfDepth,
          impulseX,
          impulseZ: 0.9,
          maxHits: remainingPassHits,
        }) : 0
        if (removed > 0) {
          contact.damage += removed
          cameraShakeRef.current = Math.max(cameraShakeRef.current, obstacle.type === 'hammer' ? 1 : 0.48)
          if (controller.getAliveCount() <= 0) {
            resolveObstacle(obstacle, contact)
            useGameStore.getState().failRun()
            audioManager.playGameOver()
            return
          }
        }
      } else {
        resolveObstacle(obstacle, contact)
      }
    }
    previousZ.current = currentZ
  })

  const fightingId = battle.current?.obstacle.id
  return (
    <>
      {obstacles.map((obstacle) => {
        if (obstacle.type === 'wall') return <WallObstacle key={obstacle.id} obstacle={obstacle} />
        if (obstacle.type === 'blocker') return <BlockerObstacle key={obstacle.id} obstacle={obstacle} />
        if (obstacle.type === 'enemy') return <EnemyObstacle key={obstacle.id} obstacle={obstacle} fighting={fightingId === obstacle.id} />
        return <HammerObstacle key={obstacle.id} obstacle={obstacle} />
      })}
    </>
  )
}
