import { useCallback, useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { useInputController } from '../../hooks/useInputController'
import { useGameStore } from '../../store/useGameStore'
import { getSkinDefinition } from '../../config/skins'
import { createOrganicFormation, gateCompression, wallCompression } from '../../utils/crowdFormation'
import { TRACK_HALF } from './GameTrack'
import type { CrowdAvoidanceArea, CrowdController, CrowdHitArea } from './CrowdRuntime'

const SPEED = { easy: 6.2, medium: 8.2, hard: 10.5, expert: 12.5 } as const
const MAX_CROWD = 240
const DEATH_SECONDS = 0.62
const CHARACTER_SCALE = 0.335
const CHARACTER_MODEL = '/models/characters/kenney-blocky-character.glb'
const PART_NAMES = ['leg-left', 'leg-right', 'torso', 'arm-left', 'arm-right', 'head'] as const
const SEPARATION_DISTANCE = 0.31
const SEPARATION_DISTANCE_SQ = SEPARATION_DISTANCE * SEPARATION_DISTANCE
const X_AXIS = new THREE.Vector3(1, 0, 0)

type PartName = typeof PART_NAMES[number]
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
  visualScale: number
  runPhase: number
}

interface CharacterPart {
  name: PartName
  geometry: THREE.BufferGeometry
  material: THREE.Material
  position: THREE.Vector3
  quaternion: THREE.Quaternion
  scale: THREE.Vector3
}

function makeMember(): CrowdMember {
  return {
    life: 'inactive', x: 0, y: 0, z: 0, targetX: 0, targetZ: 0,
    vx: 0, vy: 0, vz: 0, age: 0, scale: 0, visualScale: 1, runPhase: 0,
  }
}

function nearestGateCompression(worldZ: number, gateZs: number[]) {
  let compression = 1
  for (const gateZ of gateZs) compression = Math.min(compression, gateCompression(worldZ - gateZ))
  return compression
}

interface CrowdRunnerProps {
  difficulty: string
  isPaused: boolean
  gateZs: number[]
  controllerRef: React.MutableRefObject<CrowdController | null>
  crowdDepthRef: React.MutableRefObject<number>
  onPositionUpdate: (worldZ: number, worldX: number) => void
}

export function CrowdRunner({
  difficulty,
  isPaused,
  gateZs,
  controllerRef,
  crowdDepthRef,
  onPositionUpdate,
}: CrowdRunnerProps) {
  const groupRef = useRef<THREE.Group>(null)
  const partMeshes = useRef<Record<PartName, THREE.InstancedMesh | null>>({
    'leg-left': null, 'leg-right': null, torso: null,
    'arm-left': null, 'arm-right': null, head: null,
  })
  const members = useRef(Array.from({ length: MAX_CROWD }, makeMember))
  const separationX = useMemo(() => new Float32Array(MAX_CROWD), [])
  const separationZ = useMemo(() => new Float32Array(MAX_CROWD), [])
  const posX = useRef(0)
  const steerX = useRef(0)
  const posZ = useRef(0)
  const elapsed = useRef(0)
  const wallPressure = useRef(0)
  const formationDepth = useRef(0)
  const formationWidth = useRef(0)
  const baseFormationDepth = useRef(0)
  const baseFormationWidth = useRef(0)
  const avoidanceAreas = useRef<CrowdAvoidanceArea[]>([])
  const { scene } = useGLTF(CHARACTER_MODEL)

  const parts = useMemo<CharacterPart[]>(() => {
    scene.updateMatrixWorld(true)
    return PART_NAMES.map((name) => {
      const mesh = scene.getObjectByName(name)
      if (!(mesh instanceof THREE.Mesh)) throw new Error(`Missing character part: ${name}`)
      return {
        name,
        geometry: mesh.geometry,
        material: Array.isArray(mesh.material) ? mesh.material[0] : mesh.material,
        position: mesh.position.clone(),
        quaternion: mesh.quaternion.clone(),
        scale: mesh.scale.clone(),
      }
    })
  }, [scene])
  const partByName = useMemo(
    () => Object.fromEntries(parts.map((part) => [part.name, part])) as Record<PartName, CharacterPart>,
    [parts],
  )

  const transforms = useMemo(() => ({
    root: new THREE.Matrix4(),
    local: new THREE.Matrix4(),
    world: new THREE.Matrix4(),
    torsoWorld: new THREE.Matrix4(),
    position: new THREE.Vector3(),
    scale: new THREE.Vector3(),
    rootQuaternion: new THREE.Quaternion(),
    partQuaternion: new THREE.Quaternion(),
    poseQuaternion: new THREE.Quaternion(),
    rootEuler: new THREE.Euler(),
  }), [])

  const crowdSize = useGameStore((state) => state.crowdSize)
  const runStage = useGameStore((state) => state.runStage)
  const selectedSkin = useGameStore((state) => state.selectedSkin)
  const skin = getSkinDefinition(selectedSkin)
  const reducedEffects = useGameStore((state) => state.settings.reducedEffects)
  const { tick } = useInputController(!isPaused && runStage === 'run')

  const aliveMembers = useCallback(() => members.current.filter((member) => member.life === 'alive'), [])

  const rebuildFormation = useCallback(() => {
    const alive = aliveMembers()
    const formation = createOrganicFormation(alive.length)
    baseFormationDepth.current = formation.depth
    baseFormationWidth.current = formation.width
    formationDepth.current = formation.depth
    formationWidth.current = formation.width
    crowdDepthRef.current = formation.depth

    alive.forEach((member, index) => {
      const slot = formation.slots[index]
      member.targetX = slot.x
      member.targetZ = slot.z
      member.runPhase = slot.phase
      member.visualScale = slot.scale
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
        member.x = (Math.random() - 0.5) * 0.18
        member.y = 0
        member.z = baseFormationDepth.current + 0.35
        member.targetX = 0
        member.targetZ = baseFormationDepth.current
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
      setAvoidanceAreas: (areas) => { avoidanceAreas.current = areas },
      hitArea,
      removeFront,
    }
    return () => { controllerRef.current = null }
  }, [aliveMembers, controllerRef, hitArea, removeFront])

  useLayoutEffect(() => reconcileCount(crowdSize), [crowdSize, reconcileCount])

  useLayoutEffect(() => {
    const partColors: Record<PartName, string> = {
      'leg-left': skin.secondary,
      'leg-right': skin.secondary,
      torso: skin.primary,
      'arm-left': skin.accent,
      'arm-right': skin.accent,
      head: skin.head,
    }
    for (const [name, mesh] of Object.entries(partMeshes.current) as Array<[PartName, THREE.InstancedMesh | null]>) {
      if (!mesh) continue
      const tint = new THREE.Color(partColors[name]).lerp(new THREE.Color('#ffffff'), name === 'head' ? 0.34 : 0.2)
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
      for (let index = 0; index < MAX_CROWD; index += 1) {
        const color = tint.clone().offsetHSL((index % 7) * 0.006, 0, ((index % 5) - 2) * 0.018)
        mesh.setColorAt(index, color)
      }
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    }
  }, [parts, skin])

  const writePart = useCallback((
    name: PartName,
    index: number,
    parent: THREE.Matrix4,
    rotationX: number,
    output?: THREE.Matrix4,
  ) => {
    const part = partByName[name]
    transforms.poseQuaternion.setFromAxisAngle(X_AXIS, rotationX)
    transforms.partQuaternion.copy(part.quaternion).multiply(transforms.poseQuaternion)
    transforms.local.compose(part.position, transforms.partQuaternion, part.scale)
    const world = output ?? transforms.world
    world.multiplyMatrices(parent, transforms.local)
    partMeshes.current[name]?.setMatrixAt(index, world)
  }, [partByName, transforms])

  useFrame((_, frameDelta) => {
    if (isPaused) return
    const delta = Math.min(frameDelta, 0.05)
    elapsed.current += delta

    if (runStage === 'run' || runStage === 'bonus') {
      const speed = SPEED[difficulty as keyof typeof SPEED] ?? SPEED.medium
      posZ.current -= speed * delta
    }

    const gateScale = nearestGateCompression(posZ.current, gateZs)
    const normalHalfWidth = baseFormationWidth.current * gateScale * 0.5
    const normalLateralLimit = Math.max(0.2, TRACK_HALF - normalHalfWidth - 0.08)
    const inputDelta = runStage === 'run' ? tick(delta) : 0
    const attemptedSteer = steerX.current + inputDelta
    const pushingIntoRail = runStage === 'run'
      && Math.abs(attemptedSteer) > normalLateralLimit
      && Math.abs(inputDelta) > 0.0001
      && Math.sign(inputDelta) === Math.sign(attemptedSteer)
    wallPressure.current = THREE.MathUtils.damp(
      wallPressure.current,
      pushingIntoRail ? 1 : 0,
      pushingIntoRail ? 10 : 5,
      delta,
    )

    const wallScale = wallCompression(wallPressure.current)
    const horizontalCompression = gateScale * wallScale
    formationWidth.current = baseFormationWidth.current * horizontalCompression
    formationDepth.current = baseFormationDepth.current
      * (1 + (1 - gateScale) * 0.24 + (1 - wallScale) * 0.38)
    crowdDepthRef.current = formationDepth.current

    const formationHalfWidth = formationWidth.current * 0.5
    const lateralLimit = Math.max(0.2, TRACK_HALF - formationHalfWidth - 0.08)
    if (runStage === 'run') {
      steerX.current = THREE.MathUtils.clamp(attemptedSteer, -lateralLimit, lateralLimit)
    } else if (runStage === 'bonus') {
      steerX.current = THREE.MathUtils.damp(steerX.current, 0, 8, delta)
    }
    steerX.current = THREE.MathUtils.clamp(steerX.current, -lateralLimit, lateralLimit)
    const previousX = posX.current
    posX.current = THREE.MathUtils.damp(posX.current, steerX.current, 12, delta)
    const lateralVelocity = delta > 0 ? (posX.current - previousX) / delta : 0

    if (groupRef.current) groupRef.current.position.set(posX.current, 0, posZ.current)

    separationX.fill(0)
    separationZ.fill(0)
    for (let first = 0; first < members.current.length; first += 1) {
      const a = members.current[first]
      if (a.life !== 'alive') continue
      for (let second = first + 1; second < members.current.length; second += 1) {
        const b = members.current[second]
        if (b.life !== 'alive') continue
        const dx = a.x - b.x
        const dz = a.z - b.z
        const distanceSq = dx * dx + dz * dz
        if (distanceSq <= 0.0001 || distanceSq >= SEPARATION_DISTANCE_SQ) continue
        const distance = Math.sqrt(distanceSq)
        const force = (SEPARATION_DISTANCE - distance) / SEPARATION_DISTANCE
        const pushX = dx / distance * force
        const pushZ = dz / distance * force
        separationX[first] += pushX
        separationZ[first] += pushZ
        separationX[second] -= pushX
        separationZ[second] -= pushZ
      }
    }

    for (let index = 0; index < members.current.length; index += 1) {
      const member = members.current[index]
      if (member.life !== 'alive') continue
      const depthRatio = baseFormationDepth.current > 0 ? member.targetZ / baseFormationDepth.current : 0
      const fluidTargetX = member.targetX * horizontalCompression - lateralVelocity * depthRatio * 0.045
      const fluidTargetZ = member.targetZ
        * (1 + (1 - gateScale) * 0.24 + (1 - wallScale) * 0.38)
      member.vx += ((fluidTargetX - member.x) * 22 + separationX[index] * 18) * delta
      member.vz += ((fluidTargetZ - member.z) * 20 + separationZ[index] * 15) * delta

      const worldX = posX.current + member.x
      const worldZ = posZ.current + member.z
      for (const area of avoidanceAreas.current) {
        const ahead = worldZ - area.centerZ
        if (ahead < -area.halfDepth - 0.15 || ahead > 2.5) continue
        const lateral = worldX - area.centerX
        const expandedWidth = area.halfWidth + 0.28
        if (Math.abs(lateral) > expandedWidth) continue
        const proximity = (1 - Math.abs(lateral) / expandedWidth) * (1 - Math.max(0, ahead) / 2.5)
        const side = area.preferredSide ?? (lateral === 0 ? (area.centerX <= 0 ? 1 : -1) : Math.sign(lateral))
        member.vx += side * (area.strength ?? 2.2) * proximity * delta
        member.vz += proximity * 0.7 * delta
      }

      const damping = Math.exp(-8.5 * delta)
      member.vx *= damping
      member.vz *= damping
      member.x += member.vx * delta
      member.z += member.vz * delta
      member.x = THREE.MathUtils.clamp(member.x, -TRACK_HALF - posX.current + 0.08, TRACK_HALF - posX.current - 0.08)
      member.z = THREE.MathUtils.clamp(member.z, -0.35, formationDepth.current + 1.25)
      member.scale = THREE.MathUtils.damp(member.scale, 1, 11, delta)
    }

    let renderIndex = 0
    for (let index = 0; index < members.current.length; index += 1) {
      const member = members.current[index]
      if (member.life === 'inactive') continue

      let fall = 0
      if (member.life === 'alive') {
        const phase = elapsed.current * 10.5 + member.runPhase
        member.y = reducedEffects ? 0 : Math.abs(Math.sin(phase)) * 0.035
      } else {
        member.age += delta
        member.vy -= 7.5 * delta
        member.x += member.vx * delta
        member.y += member.vy * delta
        member.z += member.vz * delta
        member.scale = Math.max(0, 1 - member.age / DEATH_SECONDS)
        fall = Math.min(Math.PI * 0.55, member.age * 5.2)
        if (member.age >= DEATH_SECONDS) {
          member.life = 'inactive'
          continue
        }
      }

      const phase = elapsed.current * 10.5 + member.runPhase
      const swing = member.life === 'alive' ? Math.sin(phase) * 0.72 : Math.sin(member.age * 10) * 0.2
      const lean = member.life === 'alive' ? -0.12 : 0
      const rootScale = CHARACTER_SCALE * member.scale * member.visualScale
      transforms.position.set(member.x, member.y, member.z)
      transforms.scale.setScalar(rootScale)
      transforms.rootEuler.set(fall, Math.PI, member.life === 'dying' ? member.vx * 0.13 : -member.vx * 0.04)
      transforms.rootQuaternion.setFromEuler(transforms.rootEuler)
      transforms.root.compose(transforms.position, transforms.rootQuaternion, transforms.scale)

      writePart('leg-left', renderIndex, transforms.root, swing)
      writePart('leg-right', renderIndex, transforms.root, -swing)
      writePart('torso', renderIndex, transforms.root, lean, transforms.torsoWorld)
      writePart('arm-left', renderIndex, transforms.torsoWorld, -swing * 0.72)
      writePart('arm-right', renderIndex, transforms.torsoWorld, swing * 0.72)
      writePart('head', renderIndex, transforms.torsoWorld, -lean * 0.25)
      renderIndex += 1
    }

    for (const mesh of Object.values(partMeshes.current)) {
      if (!mesh) continue
      mesh.count = renderIndex
      mesh.instanceMatrix.needsUpdate = true
    }
    onPositionUpdate(posZ.current, posX.current)
  })

  const glowScale = Math.min(1 + Math.sqrt(Math.max(1, crowdSize)) * 0.16, 2.7)
  const skinColor = skin.glow

  return (
    <group ref={groupRef}>
      {parts.map((part) => (
        <instancedMesh
          key={part.name}
          ref={(mesh) => { partMeshes.current[part.name] = mesh }}
          args={[part.geometry, part.material, MAX_CROWD]}
          frustumCulled={false}
        />
      ))}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.018, 0.45]} scale={[glowScale, glowScale * 0.65, 1]}>
        <circleGeometry args={[0.82, 18]} />
        <meshBasicMaterial
          color={skinColor}
          transparent
          opacity={skin.rarity === 'Legendary' ? 0.28 : skin.rarity === 'Epic' ? 0.23 : 0.18}
          depthWrite={false}
        />
      </mesh>
    </group>
  )
}

useGLTF.preload(CHARACTER_MODEL)
