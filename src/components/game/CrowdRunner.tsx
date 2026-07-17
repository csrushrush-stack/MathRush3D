import { useCallback, useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useInputController } from '../../hooks/useInputController'
import { useGameStore } from '../../store/useGameStore'
import { TRACK_HALF } from './GameTrack'
import type { CrowdController, CrowdHitArea } from './CrowdRuntime'

const SPEED = { easy: 6.2, medium: 8.2, hard: 10.5, expert: 12.5 } as const
const MAX_CROWD = 240
const MAX_COLUMNS = 7
const COLUMN_SPACING = 0.43
const ROW_SPACING = 0.43
const DEATH_SECONDS = 0.52
const BOB_FREQUENCY = 9
const BOB_HEIGHT = 0.055

const SKIN_COLORS: Record<string, string> = {
  default: '#8b5cf6',
  ocean: '#0ea5e9',
  flame: '#ef4444',
  forest: '#22c55e',
  gold: '#f59e0b',
  night: '#312e81',
}

type MemberLife = 'inactive' | 'alive' | 'dying'

interface CrowdMember {
  life: MemberLife
  x: number
  y: number
  z: number
  targetX: number
  targetZ: number
  vx: number
  vy: number
  vz: number
  age: number
  scale: number
}

function makeMember(): CrowdMember {
  return {
    life: 'inactive', x: 0, y: 0, z: 0, targetX: 0, targetZ: 0,
    vx: 0, vy: 0, vz: 0, age: 0, scale: 0,
  }
}

function columnsFor(count: number) {
  // Width is intentionally capped; large crowds grow backward in additional rows.
  return Math.max(1, Math.min(MAX_COLUMNS, Math.ceil(Math.sqrt(count * 0.52))))
}

interface CrowdRunnerProps {
  difficulty: string
  isPaused: boolean
  controllerRef: React.MutableRefObject<CrowdController | null>
  crowdDepthRef: React.MutableRefObject<number>
  onPositionUpdate: (worldZ: number, worldX: number) => void
}

export function CrowdRunner({
  difficulty,
  isPaused,
  controllerRef,
  crowdDepthRef,
  onPositionUpdate,
}: CrowdRunnerProps) {
  const groupRef = useRef<THREE.Group>(null)
  const bodyRef = useRef<THREE.InstancedMesh>(null)
  const headRef = useRef<THREE.InstancedMesh>(null)
  const dummy = useMemo(() => new THREE.Object3D(), [])
  const members = useRef(Array.from({ length: MAX_CROWD }, makeMember))
  const posX = useRef(0)
  const posZ = useRef(0)
  const elapsed = useRef(0)
  const formationDepth = useRef(0)
  const formationWidth = useRef(0)

  const crowdSize = useGameStore((state) => state.crowdSize)
  const runStage = useGameStore((state) => state.runStage)
  const selectedSkin = useGameStore((state) => state.selectedSkin)
  const reducedEffects = useGameStore((state) => state.settings.reducedEffects)
  const { tick } = useInputController(!isPaused && runStage === 'run')

  const aliveMembers = useCallback(() => members.current.filter((member) => member.life === 'alive'), [])

  const rebuildFormation = useCallback(() => {
    const alive = aliveMembers()
    const columns = columnsFor(alive.length)
    const rows = Math.max(1, Math.ceil(alive.length / columns))
    formationDepth.current = Math.max(0, (rows - 1) * ROW_SPACING)
    formationWidth.current = Math.max(0, (columns - 1) * COLUMN_SPACING)
    crowdDepthRef.current = formationDepth.current

    alive.forEach((member, index) => {
      const row = Math.floor(index / columns)
      const itemsInRow = Math.min(columns, alive.length - row * columns)
      const column = index % columns
      member.targetX = (column - (itemsInRow - 1) / 2) * COLUMN_SPACING
      member.targetZ = row * ROW_SPACING
    })
  }, [aliveMembers, crowdDepthRef])

  const reconcileCount = useCallback((requestedCount: number) => {
    const desired = Math.min(MAX_CROWD, Math.max(0, Math.round(requestedCount)))
    const alive = aliveMembers()
    if (alive.length < desired) {
      let toAdd = desired - alive.length
      for (const member of members.current) {
        if (toAdd <= 0) break
        if (member.life !== 'inactive') continue
        member.life = 'alive'
        member.x = 0
        member.y = 0
        member.z = formationDepth.current
        member.targetX = 0
        member.targetZ = formationDepth.current
        member.vx = 0
        member.vy = 0
        member.vz = 0
        member.age = 0
        member.scale = 0.08
        toAdd -= 1
      }
    } else if (alive.length > desired) {
      for (const member of alive.slice(desired)) {
        member.life = 'dying'
        member.age = 0
        member.vx = member.x * 1.4
        member.vy = 1.8
        member.vz = 0.5
      }
    }
    rebuildFormation()
  }, [aliveMembers, rebuildFormation])

  const kill = useCallback((targets: CrowdMember[], impulse: { x?: number; z?: number; upward?: number }) => {
    for (const member of targets) {
      member.life = 'dying'
      member.age = 0
      member.vx = impulse.x ?? (member.x >= 0 ? 1.7 : -1.7)
      member.vy = impulse.upward ?? 2.4
      member.vz = impulse.z ?? 0.6
    }
    if (targets.length > 0) {
      rebuildFormation()
      useGameStore.getState().setCrowdSize(aliveMembers().length)
    }
    return targets.length
  }, [aliveMembers, rebuildFormation])

  const hitArea = useCallback((area: CrowdHitArea) => {
    const maximum = Math.max(0, area.maxHits ?? Number.POSITIVE_INFINITY)
    const targets: CrowdMember[] = []
    for (const member of members.current) {
      if (member.life !== 'alive') continue
      const worldX = posX.current + member.x
      const worldZ = posZ.current + member.z
      if (Math.abs(worldX - area.centerX) > area.halfWidth) continue
      if (Math.abs(worldZ - area.centerZ) > area.halfDepth) continue
      targets.push(member)
      if (targets.length >= maximum) break
    }
    return kill(targets, { x: area.impulseX, z: area.impulseZ })
  }, [kill])

  const removeFront = useCallback((count: number, _key: string, impulse = {}) => {
    const targets = aliveMembers()
      .sort((a, b) => a.z - b.z || Math.abs(a.x) - Math.abs(b.x))
      .slice(0, Math.max(0, Math.round(count)))
    return kill(targets, impulse)
  }, [aliveMembers, kill])

  useLayoutEffect(() => {
    controllerRef.current = {
      getAliveCount: () => aliveMembers().length,
      getDepth: () => formationDepth.current,
      getWidth: () => formationWidth.current,
      hitArea,
      removeFront,
    }
    return () => { controllerRef.current = null }
  }, [aliveMembers, controllerRef, hitArea, removeFront])

  useLayoutEffect(() => reconcileCount(crowdSize), [crowdSize, reconcileCount])

  useLayoutEffect(() => {
    if (!bodyRef.current || !headRef.current) return
    bodyRef.current.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
    headRef.current.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
    const base = new THREE.Color(SKIN_COLORS[selectedSkin] ?? SKIN_COLORS.default)
    for (let index = 0; index < MAX_CROWD; index += 1) {
      const color = base.clone().offsetHSL((index % 7) * 0.008, 0, ((index % 5) - 2) * 0.025)
      bodyRef.current.setColorAt(index, color)
      headRef.current.setColorAt(index, color)
    }
    if (bodyRef.current.instanceColor) bodyRef.current.instanceColor.needsUpdate = true
    if (headRef.current.instanceColor) headRef.current.instanceColor.needsUpdate = true
  }, [selectedSkin])

  useFrame((_, frameDelta) => {
    if (isPaused) return
    const delta = Math.min(frameDelta, 0.05)
    elapsed.current += delta

    if (runStage === 'run' || runStage === 'bonus') {
      const speed = SPEED[difficulty as keyof typeof SPEED] ?? SPEED.medium
      posZ.current -= speed * delta
    }
    if (runStage === 'run') {
      const formationHalfWidth = formationWidth.current * 0.5
      const lateralLimit = Math.max(0.2, TRACK_HALF - formationHalfWidth - 0.08)
      posX.current = THREE.MathUtils.clamp(posX.current + tick(delta), -lateralLimit, lateralLimit)
    } else if (runStage === 'bonus') {
      posX.current = THREE.MathUtils.damp(posX.current, 0, 8, delta)
    }

    if (groupRef.current) groupRef.current.position.set(posX.current, 0, posZ.current)

    let renderIndex = 0
    for (let index = 0; index < members.current.length; index += 1) {
      const member = members.current[index]
      if (member.life === 'inactive') continue
      if (member.life === 'alive') {
        member.x = THREE.MathUtils.damp(member.x, member.targetX, 12, delta)
        member.z = THREE.MathUtils.damp(member.z, member.targetZ, 12, delta)
        member.scale = THREE.MathUtils.damp(member.scale, 1, 11, delta)
        member.y = reducedEffects ? 0 : Math.abs(Math.sin(elapsed.current * BOB_FREQUENCY + index * 0.31)) * BOB_HEIGHT
      } else {
        member.age += delta
        member.vy -= 7.5 * delta
        member.x += member.vx * delta
        member.y += member.vy * delta
        member.z += member.vz * delta
        member.scale = Math.max(0, 1 - member.age / DEATH_SECONDS)
        if (member.age >= DEATH_SECONDS) {
          member.life = 'inactive'
          continue
        }
      }

      const fall = member.life === 'dying' ? Math.min(Math.PI * 0.5, member.age * 5) : 0.08
      dummy.position.set(member.x, 0.36 + member.y, member.z)
      dummy.rotation.set(fall, 0, member.life === 'dying' ? member.vx * 0.18 : 0)
      dummy.scale.setScalar(member.scale)
      dummy.updateMatrix()
      bodyRef.current?.setMatrixAt(renderIndex, dummy.matrix)
      dummy.position.set(member.x, 0.78 + member.y, member.z - 0.01)
      dummy.rotation.set(fall, 0, member.life === 'dying' ? member.vx * 0.18 : 0)
      dummy.updateMatrix()
      headRef.current?.setMatrixAt(renderIndex, dummy.matrix)
      renderIndex += 1
    }

    if (bodyRef.current && headRef.current) {
      bodyRef.current.count = renderIndex
      headRef.current.count = renderIndex
      bodyRef.current.instanceMatrix.needsUpdate = true
      headRef.current.instanceMatrix.needsUpdate = true
    }
    onPositionUpdate(posZ.current, posX.current)
  })

  const glowScale = Math.min(1 + Math.sqrt(Math.max(1, crowdSize)) * 0.16, 2.7)
  const skinColor = SKIN_COLORS[selectedSkin] ?? SKIN_COLORS.default

  return (
    <group ref={groupRef}>
      <instancedMesh ref={bodyRef} args={[undefined, undefined, MAX_CROWD]} frustumCulled={false}>
        <cylinderGeometry args={[0.12, 0.16, 0.48, 6]} />
        <meshStandardMaterial color="#ffffff" roughness={0.34} emissive={skinColor} emissiveIntensity={0.5} vertexColors toneMapped={false} />
      </instancedMesh>
      <instancedMesh ref={headRef} args={[undefined, undefined, MAX_CROWD]} frustumCulled={false}>
        <sphereGeometry args={[0.19, 8, 6]} />
        <meshStandardMaterial color="#ffffff" roughness={0.28} emissive={skinColor} emissiveIntensity={0.54} vertexColors toneMapped={false} />
      </instancedMesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.018, 0.45]} scale={[glowScale, glowScale * 0.65, 1]}>
        <circleGeometry args={[0.82, 18]} />
        <meshBasicMaterial color={skinColor} transparent opacity={0.2} depthWrite={false} />
      </mesh>
    </group>
  )
}
