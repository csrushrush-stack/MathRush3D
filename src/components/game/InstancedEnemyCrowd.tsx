import { useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { createOrganicFormation } from '../../utils/crowdFormation'

const CAPACITY = 32
const MODEL_URL = '/models/characters/kenney-blocky-enemy.glb'
const PART_NAMES = ['leg-left', 'leg-right', 'torso', 'arm-left', 'arm-right', 'head'] as const
const X_AXIS = new THREE.Vector3(1, 0, 0)

type PartName = typeof PART_NAMES[number]

interface CharacterPart {
  name: PartName
  geometry: THREE.BufferGeometry
  material: THREE.Material
  position: THREE.Vector3
  quaternion: THREE.Quaternion
  scale: THREE.Vector3
}

export function InstancedEnemyCrowd({ count, fighting }: { count: number; fighting: boolean }) {
  const visibleCount = Math.min(CAPACITY, Math.max(0, count))
  const groupRef = useRef<THREE.Group>(null)
  const meshes = useRef<Record<PartName, THREE.InstancedMesh | null>>({
    'leg-left': null, 'leg-right': null, torso: null,
    'arm-left': null, 'arm-right': null, head: null,
  })
  const { scene } = useGLTF(MODEL_URL)
  const formation = useMemo(() => createOrganicFormation(visibleCount), [visibleCount])
  const parts = useMemo<CharacterPart[]>(() => PART_NAMES.map((name) => {
    const mesh = scene.getObjectByName(name)
    if (!(mesh instanceof THREE.Mesh)) throw new Error(`Missing enemy character part: ${name}`)
    return {
      name,
      geometry: mesh.geometry,
      material: Array.isArray(mesh.material) ? mesh.material[0] : mesh.material,
      position: mesh.position.clone(),
      quaternion: mesh.quaternion.clone(),
      scale: mesh.scale.clone(),
    }
  }), [scene])
  const partByName = useMemo(
    () => Object.fromEntries(parts.map((part) => [part.name, part])) as Record<PartName, CharacterPart>,
    [parts],
  )
  const scratch = useMemo(() => ({
    root: new THREE.Matrix4(), local: new THREE.Matrix4(), world: new THREE.Matrix4(), torso: new THREE.Matrix4(),
    position: new THREE.Vector3(), scale: new THREE.Vector3(), rootQuaternion: new THREE.Quaternion(),
    partQuaternion: new THREE.Quaternion(), poseQuaternion: new THREE.Quaternion(), euler: new THREE.Euler(),
  }), [])

  useLayoutEffect(() => {
    const tint = new THREE.Color('#fb7185').lerp(new THREE.Color('#ffffff'), 0.4)
    for (const mesh of Object.values(meshes.current)) {
      if (!mesh) continue
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
      for (let index = 0; index < CAPACITY; index += 1) {
        mesh.setColorAt(index, tint.clone().offsetHSL((index % 5) * 0.008, 0, (index % 3) * -0.025))
      }
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    }
  }, [parts])

  useFrame(({ clock }) => {
    if (groupRef.current) {
      groupRef.current.position.z = fighting ? Math.sin(clock.elapsedTime * 18) * 0.1 : 0
      groupRef.current.rotation.y = fighting ? Math.sin(clock.elapsedTime * 13) * 0.025 : 0
    }

    const writePart = (name: PartName, index: number, parent: THREE.Matrix4, rotationX: number, output?: THREE.Matrix4) => {
      const part = partByName[name]
      scratch.poseQuaternion.setFromAxisAngle(X_AXIS, rotationX)
      scratch.partQuaternion.copy(part.quaternion).multiply(scratch.poseQuaternion)
      scratch.local.compose(part.position, scratch.partQuaternion, part.scale)
      const world = output ?? scratch.world
      world.multiplyMatrices(parent, scratch.local)
      meshes.current[name]?.setMatrixAt(index, world)
    }

    formation.slots.forEach((slot, index) => {
      const phase = clock.elapsedTime * (fighting ? 12 : 7) + slot.phase
      const swing = Math.sin(phase) * (fighting ? 0.75 : 0.28)
      const bob = Math.abs(Math.sin(phase)) * (fighting ? 0.045 : 0.018)
      scratch.position.set(slot.x * 0.92, bob, -slot.z * 0.78)
      scratch.scale.setScalar(0.31 * slot.scale)
      scratch.euler.set(0, 0, Math.sin(phase * 0.5) * 0.025)
      scratch.rootQuaternion.setFromEuler(scratch.euler)
      scratch.root.compose(scratch.position, scratch.rootQuaternion, scratch.scale)

      writePart('leg-left', index, scratch.root, swing)
      writePart('leg-right', index, scratch.root, -swing)
      writePart('torso', index, scratch.root, fighting ? 0.1 : 0, scratch.torso)
      writePart('arm-left', index, scratch.torso, -swing * 0.7)
      writePart('arm-right', index, scratch.torso, swing * 0.7)
      writePart('head', index, scratch.torso, 0)
    })

    for (const mesh of Object.values(meshes.current)) {
      if (!mesh) continue
      mesh.count = formation.slots.length
      mesh.instanceMatrix.needsUpdate = true
    }
  })

  return (
    <group ref={groupRef}>
      {parts.map((part) => (
        <instancedMesh
          key={part.name}
          ref={(mesh) => { meshes.current[part.name] = mesh }}
          args={[part.geometry, part.material, CAPACITY]}
          frustumCulled={false}
        />
      ))}
    </group>
  )
}

useGLTF.preload(MODEL_URL)
