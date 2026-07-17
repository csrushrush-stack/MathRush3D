/**
 * HomeBackground – React Three Fiber scene, portrait-mobile optimised.
 *
 * Camera tuned for a 9:16 portrait shell:
 *   - y=3.2  → road occupies the lower ~35% of the frame
 *   - z=9    → tighter pull-back keeps the road visible but not dominating
 *   - FOV 70 → wider vertical FOV for portrait, shows more sky above road
 *
 * Orbs are pulled inward (±3.5 x) so they stay visible in a narrow
 * portrait viewport without being clipped at the edges.
 */
import { Canvas, useFrame } from '@react-three/fiber'
import { Sky, Float } from '@react-three/drei'
import { Suspense, useRef } from 'react'
import type { Mesh } from 'three'

/* ── Glowing icosahedron orb ── */
interface OrbProps {
  position: [number, number, number]
  color: string
  size?: number
  speed?: number
}

function Orb({ position, color, size = 0.55, speed = 1 }: OrbProps) {
  const ref = useRef<Mesh>(null)
  useFrame((_, dt) => {
    if (!ref.current) return
    ref.current.rotation.y += dt * 0.4 * speed
    ref.current.rotation.z += dt * 0.2 * speed
  })
  return (
    <Float speed={speed * 0.9} floatIntensity={0.6} rotationIntensity={0.08}>
      <mesh ref={ref} position={position}>
        <icosahedronGeometry args={[size, 1]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={0.4}
          roughness={0.08}
          metalness={0.9}
        />
      </mesh>
    </Float>
  )
}

/* ── Running track ── */
function Road() {
  return (
    <group>
      {/* Surface */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.8, -4]} receiveShadow>
        <planeGeometry args={[5, 120]} />
        <meshStandardMaterial color="#1e40ad" roughness={0.65} metalness={0.2} />
      </mesh>

      {/* Centre dashes */}
      {[-50, -40, -30, -20, -10, 0, 10, 18].map((z) => (
        <mesh key={z} rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.79, z - 4]}>
          <planeGeometry args={[0.16, 3.2]} />
          <meshStandardMaterial color="#ffffff" opacity={0.15} transparent />
        </mesh>
      ))}

      {/* Gold rails */}
      {([-2.55, 2.55] as number[]).map((x) => (
        <mesh key={x} position={[x, -1.74, -4]}>
          <boxGeometry args={[0.1, 0.06, 120]} />
          <meshStandardMaterial
            color="#fbbf24" emissive="#fbbf24"
            emissiveIntensity={0.9} roughness={0.04} metalness={1}
          />
        </mesh>
      ))}

      {/* Wide shoulder pads */}
      {([-4, 4] as number[]).map((x) => (
        <mesh key={x} rotation={[-Math.PI / 2, 0, 0]} position={[x, -1.81, -4]}>
          <planeGeometry args={[2.5, 120]} />
          <meshStandardMaterial color="#1a4fa0" roughness={0.8} metalness={0.05} />
        </mesh>
      ))}
    </group>
  )
}

/* ── Main export ── */
export function HomeBackground() {
  return (
    <Canvas
      shadows
      /*
        Portrait-optimised camera for 9:16 shell:
        - y=3.2  → camera lower so road sits in bottom third of frame
        - z=9    → slightly closer for tighter portrait framing
        - FOV 70 → wider vertical angle reveals sky beautifully in portrait
      */
      camera={{ position: [0, 3.2, 9], fov: 70, near: 0.1, far: 200 }}
      style={{ background: 'linear-gradient(180deg,#0f62d0 0%,#1e90ff 55%,#38bdf8 100%)' }}
    >
      <Suspense fallback={null}>
        {/* Vivid saturated sky */}
        <Sky
          sunPosition={[60, 22, 40]}
          turbidity={0.6}
          rayleigh={3.5}
          mieCoefficient={0.002}
          mieDirectionalG={0.9}
        />

        {/* Lighting */}
        <ambientLight intensity={1.0} />
        <directionalLight position={[6, 18, 8]} intensity={2.8} castShadow />
        <pointLight position={[0, 5, 2]} intensity={1.0} color="#bfdbfe" />

        {/* Track */}
        <Road />

        {/*
          Portrait-centric orb placement:
          x-spread tightened to ±3.5 so orbs stay visible in narrow portrait shell.
          Near pair slightly inward, deeper pairs arc up for a dramatic sky effect.
        */}
        {/* Near pair */}
        <Orb position={[-3.5,  2.5, -5 ]} color="#6366f1" speed={0.8}  size={0.5} />
        <Orb position={[ 3.5,  2.5, -5 ]} color="#06b6d4" speed={1.0}  size={0.5} />

        {/* Mid pair */}
        <Orb position={[-4.5,  4.5, -14]} color="#8b5cf6" speed={0.6}  size={0.65} />
        <Orb position={[ 4.5,  4.5, -14]} color="#0ea5e9" speed={0.7}  size={0.65} />

        {/* Far pair */}
        <Orb position={[-3.5,  8.0, -26]} color="#4f46e5" speed={0.45} size={0.6} />
        <Orb position={[ 3.5,  8.0, -26]} color="#2563eb" speed={0.5}  size={0.6} />

        {/* Deep background – large, moody */}
        <Orb position={[-6.0, 11.5, -42]} color="#7c3aed" speed={0.3}  size={0.95} />
        <Orb position={[ 6.0, 11.5, -42]} color="#0369a1" speed={0.35} size={0.95} />

        {/* Tighter fog starts closer for dramatic portrait depth */}
        <fog attach="fog" args={['#1d4ed8', 14, 52]} />
      </Suspense>
    </Canvas>
  )
}
